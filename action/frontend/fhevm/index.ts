/**
 * FHEVM模块主入口
 * 导出所有FHEVM相关的功能和类型
 */

// 类型定义
export * from "./types";

// SDK加载器
export * from "./sdk-loader";

// 实例管理器
export * from "./instance-manager";

// 存储管理
export * from "./storage";

// React Hooks
export * from "./useFhevm";

// 解密签名管理
export * from "./decryption-signature";

// 便捷函数和工具
export { 
  createFhevmInstance, 
  getCurrentFhevmInstance 
} from "./instance-manager";

export { 
  loadAndInitSDK, 
  getSDKStatus 
} from "./sdk-loader";

export { 
  createStorage, 
  createDecryptionSignatureStorage 
} from "./storage";
