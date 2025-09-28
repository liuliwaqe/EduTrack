/**
 * FHEVM存储管理
 * 负责公钥、参数和解密签名的持久化存储
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";
import { GenericStringStorage } from "./types";

/**
 * 公钥存储数据结构
 */
interface PublicKeyData {
  id: string;
  data: string;
}

interface PublicParamsData {
  "2048": string;
}

/**
 * IndexedDB数据库结构
 */
interface FhevmDB extends DBSchema {
  publicKeys: {
    key: string; // ACL地址
    value: {
      aclAddress: string;
      publicKey: PublicKeyData;
      timestamp: number;
    };
  };
  publicParams: {
    key: string; // ACL地址
    value: {
      aclAddress: string;
      params: PublicParamsData;
      timestamp: number;
    };
  };
  decryptionSignatures: {
    key: string; // 签名键
    value: {
      key: string;
      signature: string;
      publicKey: string;
      privateKey: string;
      contractAddresses: string[];
      userAddress: string;
      startTimestamp: number;
      durationDays: number;
      eip712: any;
      timestamp: number;
    };
  };
}

/**
 * 公钥存储管理器
 */
class PublicKeyStorage {
  private dbPromise: Promise<IDBPDatabase<FhevmDB>> | null = null;

  /**
   * 获取数据库连接
   */
  private async getDB(): Promise<IDBPDatabase<FhevmDB>> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    if (typeof window === "undefined") {
      throw new Error("IndexedDB not available in server environment");
    }

    this.dbPromise = openDB<FhevmDB>("fhevm-storage", 1, {
  upgrade(db: IDBPDatabase<FhevmDB>) {
    // 创建公钥存储
    if (!db.objectStoreNames.contains("publicKeys")) {
      db.createObjectStore("publicKeys", { keyPath: "aclAddress" });
    }

    // 创建公共参数存储
    if (!db.objectStoreNames.contains("publicParams")) {
      db.createObjectStore("publicParams", { keyPath: "aclAddress" });
    }

    // 创建解密签名存储
    if (!db.objectStoreNames.contains("decryptionSignatures")) {
      db.createObjectStore("decryptionSignatures", { keyPath: "key" });
    }
  },
    });

    return this.dbPromise;
  }

  /**
   * 获取公钥和参数
   */
  async get(aclAddress: string): Promise<{
    publicKey?: PublicKeyData;
    publicParams: PublicParamsData | null;
  }> {
    try {
      const db = await this.getDB();

      const [publicKeyEntry, publicParamsEntry] = await Promise.all([
        db.get("publicKeys", aclAddress),
        db.get("publicParams", aclAddress),
      ]);

      return {
        publicKey: publicKeyEntry?.publicKey,
        publicParams: publicParamsEntry?.params || null,
      };
    } catch (error) {
      console.warn("Failed to get public data from storage:", error);
      return { publicParams: null };
    }
  }

  /**
   * 保存公钥和参数
   */
  async set(
    aclAddress: string,
    publicKey: PublicKeyData | null,
    publicParams: PublicParamsData | null
  ): Promise<void> {
    try {
      const db = await this.getDB();
      const timestamp = Date.now();

      const promises: Promise<any>[] = [];

      if (publicKey) {
        promises.push(
          db.put("publicKeys", {
            aclAddress,
            publicKey,
            timestamp,
          })
        );
      }

      if (publicParams) {
        promises.push(
          db.put("publicParams", {
            aclAddress,
            params: publicParams,
            timestamp,
          })
        );
      }

      await Promise.all(promises);
    } catch (error) {
      console.warn("Failed to save public data to storage:", error);
    }
  }

  /**
   * 清理过期数据
   */
  async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const db = await this.getDB();
      const cutoff = Date.now() - maxAge;

      const tx = db.transaction(["publicKeys", "publicParams", "decryptionSignatures"], "readwrite");

      // 清理公钥
      const publicKeysCursor = await tx.objectStore("publicKeys").openCursor();
      if (publicKeysCursor) {
        for await (const cursor of publicKeysCursor) {
          if (cursor.value.timestamp < cutoff) {
            cursor.delete();
          }
        }
      }

      // 清理参数
      const publicParamsCursor = await tx.objectStore("publicParams").openCursor();
      if (publicParamsCursor) {
        for await (const cursor of publicParamsCursor) {
          if (cursor.value.timestamp < cutoff) {
            cursor.delete();
          }
        }
      }

      // 清理解密签名
      const signaturesCursor = await tx.objectStore("decryptionSignatures").openCursor();
      if (signaturesCursor) {
        for await (const cursor of signaturesCursor) {
          if (cursor.value.timestamp < cutoff) {
            cursor.delete();
          }
        }
      }

      await tx.done;
    } catch (error) {
      console.warn("Failed to cleanup storage:", error);
    }
  }
}

/**
 * 内存存储实现
 */
export class InMemoryStorage implements GenericStringStorage {
  private storage = new Map<string, string>();

  getItem(key: string): string | null {
    return this.storage.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.storage.set(key, value);
  }

  removeItem(key: string): void {
    this.storage.delete(key);
  }

  clear(): void {
    this.storage.clear();
  }

  get size(): number {
    return this.storage.size;
  }
}

/**
 * IndexedDB存储实现
 */
export class IndexedDBStorage implements GenericStringStorage {
  private dbPromise: Promise<IDBPDatabase<any>> | null = null;

  constructor(private dbName: string = "fhevm-generic-storage") {}

  private async getDB(): Promise<IDBPDatabase<any>> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = openDB(this.dbName, 1, {
      upgrade(db: IDBPDatabase<any>) {
        if (!db.objectStoreNames.contains("storage")) {
          db.createObjectStore("storage");
        }
      },
    });

    return this.dbPromise;
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const db = await this.getDB();
      const value = await db.get("storage", key);
      return value || null;
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put("storage", value, key);
    } catch (error) {
      console.warn("Failed to set item in IndexedDB:", error);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      await db.delete("storage", key);
    } catch (error) {
      console.warn("Failed to remove item from IndexedDB:", error);
    }
  }
}

/**
 * 解密签名存储管理器
 */
export class DecryptionSignatureStorage {
  private storage: GenericStringStorage;

  constructor(storage?: GenericStringStorage) {
    this.storage = storage || new InMemoryStorage();
  }

  /**
   * 生成签名存储键
   */
  private generateKey(
    userAddress: string,
    contractAddresses: string[],
    publicKey?: string
  ): string {
    const contracts = [...contractAddresses].sort().join(",");
    const keyParts = [userAddress.toLowerCase(), contracts];
    
    if (publicKey) {
      keyParts.push(publicKey);
    }
    
    return `fhevm-signature:${keyParts.join(":")}`;
  }

  /**
   * 保存解密签名
   */
  async save(
    userAddress: string,
    contractAddresses: string[],
    signatureData: {
      signature: string;
      publicKey: string;
      privateKey: string;
      startTimestamp: number;
      durationDays: number;
      eip712: any;
    }
  ): Promise<void> {
    const key = this.generateKey(userAddress, contractAddresses, signatureData.publicKey);
    
    const data = {
      ...signatureData,
      contractAddresses,
      userAddress,
      timestamp: Date.now(),
    };

    await this.storage.setItem(key, JSON.stringify(data));
  }

  /**
   * 加载解密签名
   */
  async load(
    userAddress: string,
    contractAddresses: string[],
    publicKey?: string
  ): Promise<any | null> {
    const key = this.generateKey(userAddress, contractAddresses, publicKey);
    
    try {
      const data = await this.storage.getItem(key);
      if (!data) return null;

      const parsed = JSON.parse(data);
      
      // 检查签名是否过期
      const now = Math.floor(Date.now() / 1000);
      const expiry = parsed.startTimestamp + parsed.durationDays * 24 * 60 * 60;
      
      if (now >= expiry) {
        // 签名已过期，删除它
        await this.storage.removeItem(key);
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * 删除解密签名
   */
  async remove(
    userAddress: string,
    contractAddresses: string[],
    publicKey?: string
  ): Promise<void> {
    const key = this.generateKey(userAddress, contractAddresses, publicKey);
    await this.storage.removeItem(key);
  }
}

/**
 * 全局存储实例
 */
export const publicKeyStorage = new PublicKeyStorage();
export const inMemoryStorage = new InMemoryStorage();
export const indexedDBStorage = new IndexedDBStorage();

/**
 * 创建解密签名存储
 */
export function createDecryptionSignatureStorage(
  storage?: GenericStringStorage
): DecryptionSignatureStorage {
  return new DecryptionSignatureStorage(storage);
}

/**
 * 存储工厂函数
 */
export function createStorage(type: "memory" | "indexeddb" = "memory"): GenericStringStorage {
  switch (type) {
    case "indexeddb":
      return new IndexedDBStorage();
    case "memory":
    default:
      return new InMemoryStorage();
  }
}
