/**
 * FHEVM解密签名管理器
 * 处理EIP712签名的生成、缓存和验证
 */

import { ethers } from "ethers";
import { FhevmInstance, DecryptionSignature, EIP712Data, GenericStringStorage, FHEVM_CONSTANTS } from "./types";
import { createDecryptionSignatureStorage } from "./storage";

/**
 * 解密签名管理器类
 */
export class FhevmDecryptionSignatureManager {
  private storage: ReturnType<typeof createDecryptionSignatureStorage>;

  constructor(storage: GenericStringStorage) {
    this.storage = createDecryptionSignatureStorage(storage);
  }

  /**
   * 验证签名是否有效（未过期）
   */
  private isSignatureValid(signature: DecryptionSignature): boolean {
    const now = Math.floor(Date.now() / 1000);
    const expiry = signature.startTimestamp + signature.durationDays * 24 * 60 * 60;
    return now < expiry;
  }

  /**
   * 从存储加载签名
   */
  async loadSignature(
    instance: FhevmInstance,
    contractAddresses: string[],
    userAddress: string,
    publicKey?: string
  ): Promise<DecryptionSignature | null> {
    try {
      const data = await this.storage.load(userAddress, contractAddresses, publicKey);
      
      if (!data) {
        return null;
      }

      const signature: DecryptionSignature = {
        publicKey: data.publicKey,
        privateKey: data.privateKey,
        signature: data.signature,
        contractAddresses: data.contractAddresses,
        userAddress: data.userAddress,
        startTimestamp: data.startTimestamp,
        durationDays: data.durationDays,
        eip712: data.eip712,
      };

      // 检查签名是否仍然有效
      if (this.isSignatureValid(signature)) {
        return signature;
      }

      // 签名已过期，删除它
      await this.storage.remove(userAddress, contractAddresses, publicKey);
      return null;

    } catch (error) {
      console.warn("Failed to load decryption signature:", error);
      return null;
    }
  }

  /**
   * 创建新的解密签名
   */
  async createSignature(
    instance: FhevmInstance,
    contractAddresses: string[],
    signer: ethers.Signer,
    keyPair?: { publicKey: string; privateKey: string }
  ): Promise<DecryptionSignature | null> {
    try {
      const userAddress = await signer.getAddress();
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = FHEVM_CONSTANTS.SIGNATURE_DURATION_DAYS;

      // 生成或使用提供的密钥对
      const { publicKey, privateKey } = keyPair ?? instance.generateKeypair();

      // 创建EIP712签名数据
      const eip712 = instance.createEIP712(
        publicKey,
        contractAddresses,
        startTimestamp,
        durationDays
      );

      // 请求用户签名
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );

      const decryptionSignature: DecryptionSignature = {
        publicKey,
        privateKey,
        signature,
        contractAddresses,
        userAddress,
        startTimestamp,
        durationDays,
        eip712,
      };

      return decryptionSignature;

    } catch (error) {
      console.error("Failed to create decryption signature:", error);
      return null;
    }
  }

  /**
   * 保存签名到存储
   */
  async saveSignature(signature: DecryptionSignature): Promise<void> {
    try {
      await this.storage.save(
        signature.userAddress,
        signature.contractAddresses,
        {
          signature: signature.signature,
          publicKey: signature.publicKey,
          privateKey: signature.privateKey,
          startTimestamp: signature.startTimestamp,
          durationDays: signature.durationDays,
          eip712: signature.eip712,
        }
      );
    } catch (error) {
      console.warn("Failed to save decryption signature:", error);
    }
  }

  /**
   * 加载或创建签名（主要接口）
   */
  async getOrCreateSignature(
    instance: FhevmInstance,
    contractAddresses: string[],
    signer: ethers.Signer,
    keyPair?: { publicKey: string; privateKey: string }
  ): Promise<DecryptionSignature | null> {
    const userAddress = await signer.getAddress();

    // 尝试从缓存加载
    let signature = await this.loadSignature(
      instance,
      contractAddresses,
      userAddress,
      keyPair?.publicKey
    );

    if (signature) {
      console.log("✅ Loaded cached decryption signature");
      return signature;
    }

    // 创建新签名
    console.log("🔐 Creating new decryption signature...");
    signature = await this.createSignature(instance, contractAddresses, signer, keyPair);

    if (!signature) {
      return null;
    }

    // 保存到缓存
    await this.saveSignature(signature);
    console.log("✅ Created and cached new decryption signature");

    return signature;
  }

  /**
   * 删除签名
   */
  async removeSignature(
    userAddress: string,
    contractAddresses: string[],
    publicKey?: string
  ): Promise<void> {
    await this.storage.remove(userAddress, contractAddresses, publicKey);
  }

  /**
   * 刷新签名（删除旧的，创建新的）
   */
  async refreshSignature(
    instance: FhevmInstance,
    contractAddresses: string[],
    signer: ethers.Signer,
    keyPair?: { publicKey: string; privateKey: string }
  ): Promise<DecryptionSignature | null> {
    const userAddress = await signer.getAddress();
    
    // 删除旧签名
    await this.removeSignature(userAddress, contractAddresses, keyPair?.publicKey);
    
    // 创建新签名
    return await this.getOrCreateSignature(instance, contractAddresses, signer, keyPair);
  }
}

/**
 * 便捷的解密签名Hook
 */
import { useState, useCallback, useRef } from "react";

export interface UseDecryptionSignatureOptions {
  autoRefresh?: boolean;
  refreshThreshold?: number; // 距离过期多少秒时自动刷新
}

export function useDecryptionSignature(
  instance: FhevmInstance | undefined,
  contractAddresses: string[],
  signer: ethers.Signer | undefined,
  storage: GenericStringStorage,
  options: UseDecryptionSignatureOptions = {}
) {
  const { autoRefresh = true, refreshThreshold = 24 * 60 * 60 } = options; // 默认过期前24小时刷新

  const [signature, setSignature] = useState<DecryptionSignature | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const managerRef = useRef<FhevmDecryptionSignatureManager | null>(null);

  // 初始化管理器
  if (!managerRef.current && storage) {
    managerRef.current = new FhevmDecryptionSignatureManager(storage);
  }

  /**
   * 获取或创建签名
   */
  const getSignature = useCallback(async (
    keyPair?: { publicKey: string; privateKey: string }
  ): Promise<DecryptionSignature | null> => {
    if (!instance || !signer || !managerRef.current) {
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 检查是否需要刷新现有签名
      if (signature && autoRefresh) {
        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = (signature.startTimestamp + signature.durationDays * 24 * 60 * 60) - now;
        
        if (timeUntilExpiry < refreshThreshold) {
          console.log("🔄 Refreshing decryption signature (approaching expiry)");
          const newSignature = await managerRef.current.refreshSignature(
            instance,
            contractAddresses,
            signer,
            keyPair
          );
          setSignature(newSignature);
          return newSignature;
        }
      }

      // 获取或创建签名
      const result = await managerRef.current.getOrCreateSignature(
        instance,
        contractAddresses,
        signer,
        keyPair
      );

      setSignature(result);
      return result;

    } catch (err) {
      const error = err as Error;
      setError(error);
      console.error("Failed to get decryption signature:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [instance, signer, contractAddresses, signature, autoRefresh, refreshThreshold]);

  /**
   * 刷新签名
   */
  const refresh = useCallback(async (
    keyPair?: { publicKey: string; privateKey: string }
  ): Promise<DecryptionSignature | null> => {
    if (!instance || !signer || !managerRef.current) {
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await managerRef.current.refreshSignature(
        instance,
        contractAddresses,
        signer,
        keyPair
      );
      setSignature(result);
      return result;
    } catch (err) {
      const error = err as Error;
      setError(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [instance, signer, contractAddresses]);

  /**
   * 清除签名
   */
  const clear = useCallback(async () => {
    if (!signer || !managerRef.current) return;

    try {
      const userAddress = await signer.getAddress();
      await managerRef.current.removeSignature(userAddress, contractAddresses);
      setSignature(null);
    } catch (error) {
      console.warn("Failed to clear signature:", error);
    }
  }, [signer, contractAddresses]);

  return {
    signature,
    isLoading,
    error,
    getSignature,
    refresh,
    clear,
    isValid: signature ? 
      Math.floor(Date.now() / 1000) < (signature.startTimestamp + signature.durationDays * 24 * 60 * 60) :
      false,
  };
}
