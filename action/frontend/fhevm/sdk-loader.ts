/**
 * FHEVM SDK 动态加载器
 * 负责从CDN加载FHEVM Relayer SDK并初始化
 */

import { FHEVM_CONSTANTS, FhevmWindow } from "./types";

/**
 * SDK加载器类
 */
export class FhevmSDKLoader {
  private static instance: FhevmSDKLoader;
  private loadPromise: Promise<void> | null = null;
  private initPromise: Promise<boolean> | null = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): FhevmSDKLoader {
    if (!FhevmSDKLoader.instance) {
      FhevmSDKLoader.instance = new FhevmSDKLoader();
    }
    return FhevmSDKLoader.instance;
  }

  /**
   * 检查SDK是否已加载
   */
  isLoaded(): boolean {
    return "relayerSDK" in window && typeof (window as FhevmWindow).relayerSDK === "object";
  }

  /**
   * 检查SDK是否已初始化
   */
  isInitialized(): boolean {
    if (!this.isLoaded()) return false;
    const win = window as unknown as FhevmWindow;
    return win.relayerSDK.__initialized__ === true;
  }

  /**
   * 从CDN加载SDK
   */
  async loadSDK(): Promise<void> {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    if (this.isLoaded()) {
      return Promise.resolve();
    }

    this.loadPromise = new Promise((resolve, reject) => {
      // 创建script标签
      const script = document.createElement("script");
      script.src = FHEVM_CONSTANTS.SDK_CDN_URL;
      script.type = "text/javascript";
      script.async = true;

      // 成功回调
      script.onload = () => {
        if (!this.isLoaded()) {
          reject(new Error("SDK loaded but window.relayerSDK is not available"));
          return;
        }
        console.log("✅ FHEVM SDK loaded successfully");
        resolve();
      };

      // 失败回调
      script.onerror = () => {
        reject(new Error(`Failed to load FHEVM SDK from ${FHEVM_CONSTANTS.SDK_CDN_URL}`));
      };

      // 添加到页面
      document.head.appendChild(script);
    });

    return this.loadPromise;
  }

  /**
   * 初始化SDK
   */
  async initSDK(options?: any): Promise<boolean> {
    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.isInitialized()) {
      return Promise.resolve(true);
    }

    if (!this.isLoaded()) {
      await this.loadSDK();
    }

    this.initPromise = new Promise(async (resolve, reject) => {
      try {
        const win = window as unknown as FhevmWindow;
        const result = await win.relayerSDK.initSDK(options);
        
        if (result) {
          win.relayerSDK.__initialized__ = true;
          console.log("✅ FHEVM SDK initialized successfully");
          resolve(true);
        } else {
          reject(new Error("SDK initialization returned false"));
        }
      } catch (error) {
        reject(new Error(`SDK initialization failed: ${error}`));
      }
    });

    return this.initPromise;
  }

  /**
   * 获取SDK实例
   */
  getSDK(): FhevmWindow["relayerSDK"] | null {
    if (!this.isLoaded()) {
      return null;
    }
    return (window as unknown as FhevmWindow).relayerSDK;
  }

  /**
   * 重置加载状态（用于测试或重新加载）
   */
  reset(): void {
    this.loadPromise = null;
    this.initPromise = null;
    
    // 清理window对象
    const win = window as any;
    if (win.relayerSDK) {
      delete win.relayerSDK;
    }

    // 移除script标签
    const scripts = document.querySelectorAll(`script[src="${FHEVM_CONSTANTS.SDK_CDN_URL}"]`);
    scripts.forEach(script => script.remove());
  }
}

/**
 * 全局SDK加载器实例
 */
export const sdkLoader = FhevmSDKLoader.getInstance();

/**
 * 便捷函数：加载并初始化SDK
 */
export async function loadAndInitSDK(options?: any): Promise<boolean> {
  await sdkLoader.loadSDK();
  return await sdkLoader.initSDK(options);
}

/**
 * 便捷函数：检查SDK状态
 */
export function getSDKStatus(): {
  loaded: boolean;
  initialized: boolean;
  available: boolean;
} {
  const loaded = sdkLoader.isLoaded();
  const initialized = sdkLoader.isInitialized();
  
  return {
    loaded,
    initialized,
    available: loaded && initialized,
  };
}

/**
 * 错误类型定义
 */
export class FhevmSDKError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = "FhevmSDKError";
  }
}

/**
 * SDK加载错误
 */
export class SDKLoadError extends FhevmSDKError {
  constructor(message: string, details?: any) {
    super(message, "SDK_LOAD_ERROR", details);
  }
}

/**
 * SDK初始化错误
 */
export class SDKInitError extends FhevmSDKError {
  constructor(message: string, details?: any) {
    super(message, "SDK_INIT_ERROR", details);
  }
}

/**
 * 带重试的SDK加载
 */
export async function loadSDKWithRetry(
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<void> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      await sdkLoader.loadSDK();
      return;
    } catch (error) {
      lastError = error as Error;
      console.warn(`SDK load attempt ${i + 1} failed:`, error);
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        sdkLoader.reset(); // 重置状态以便重试
      }
    }
  }

  throw new SDKLoadError(`Failed to load SDK after ${maxRetries} attempts`, lastError);
}

/**
 * 带重试的SDK初始化
 */
export async function initSDKWithRetry(
  options?: any,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<boolean> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await sdkLoader.initSDK(options);
    } catch (error) {
      lastError = error as Error;
      console.warn(`SDK init attempt ${i + 1} failed:`, error);
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  throw new SDKInitError(`Failed to initialize SDK after ${maxRetries} attempts`, lastError);
}
