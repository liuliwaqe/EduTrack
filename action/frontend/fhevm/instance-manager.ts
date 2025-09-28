/**
 * FHEVM实例管理器
 * 负责创建、管理和缓存FHEVM实例
 */

import { ethers } from "ethers";
import { FhevmInstance, FhevmInstanceConfig, MockFhevmInstance, FHEVM_CONSTANTS } from "./types";
import { sdkLoader, FhevmSDKError } from "./sdk-loader";
import { publicKeyStorage } from "./storage";

/**
 * 实例管理器类
 */
export class FhevmInstanceManager {
  private static instance: FhevmInstanceManager;
  private currentInstance: FhevmInstance | null = null;
  private currentConfig: FhevmInstanceConfig | null = null;

  private constructor() {}

  static getInstance(): FhevmInstanceManager {
    if (!FhevmInstanceManager.instance) {
      FhevmInstanceManager.instance = new FhevmInstanceManager();
    }
    return FhevmInstanceManager.instance;
  }

  /**
   * 检测是否为本地FHEVM节点
   */
  private async detectLocalFhevmNode(rpcUrl: string): Promise<boolean> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // 1. 检查客户端版本
      const clientVersion = await provider.send("web3_clientVersion", []);
      console.log("Client version:", clientVersion);
      
      if (!clientVersion.toLowerCase().includes("hardhat")) {
        return false;
      }

      // 2. 检查FHEVM relayer元数据端点（根据用户分析的正确方法）
      try {
        const metadata = await provider.send("fhevm_relayer_metadata", []);
        console.log("✅ Detected local FHEVM node with relayer metadata:", metadata);
        return true;
      } catch (error) {
        console.log("No fhevm_relayer_metadata found, trying hardhat_metadata...");
        try {
          const metadata = await provider.send("hardhat_metadata", []);
          console.log("✅ Detected local FHEVM node with hardhat metadata:", metadata);
          return true;
        } catch {
          return false;
        }
      }
    } catch (error) {
      console.warn("Failed to detect local FHEVM node:", error);
      return false;
    }
  }

  /**
   * 获取RPC URL和链ID
   */
  private async resolveNetworkInfo(
    provider: string | ethers.Eip1193Provider,
    mockChains?: Record<number, string>
  ): Promise<{ rpcUrl: string; chainId: number; isMock: boolean }> {
    let rpcUrl: string;
    let chainId: number;

    if (typeof provider === "string") {
      rpcUrl = provider;
      // 从RPC URL推断链ID
      const tempProvider = new ethers.JsonRpcProvider(rpcUrl);
      const network = await tempProvider.getNetwork();
      chainId = Number(network.chainId);
    } else {
      // 从EIP1193 provider获取链ID
      const chainIdHex = await provider.request({ method: "eth_chainId" });
      chainId = parseInt(chainIdHex, 16);
      
      // 检查是否有mock链配置
      if (mockChains && mockChains[chainId]) {
        rpcUrl = mockChains[chainId];
      } else {
        // 使用provider作为网络配置
        rpcUrl = ""; // 将在后续使用provider对象
      }
    }

    // 检查是否为本地开发环境
    const isMock = chainId === FHEVM_CONSTANTS.LOCAL_CHAIN_ID;
    
    // 如果是本地链，强制使用Mock模式
    if (isMock && !rpcUrl) {
      rpcUrl = "http://127.0.0.1:8545";
    }

    return { rpcUrl, chainId, isMock };
  }

  /**
   * 创建Mock实例（本地开发）
   */
  private async createMockInstance(
    rpcUrl: string,
    chainId: number
  ): Promise<MockFhevmInstance> {
    try {
      console.log("🚀 Creating mock FHEVM instance for chain:", chainId);
      
      // 1. 检测FHEVM节点
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      console.log("✅ Provider created");
      
      // 2. 获取FHEVM relayer元数据以获取合约地址
      let metadata: any = {};
      try {
        metadata = await provider.send("fhevm_relayer_metadata", []);
        console.log("✅ FHEVM node detected with metadata:", metadata);
      } catch (error) {
        console.log("⚠️ No fhevm_relayer_metadata, using mock mode");
      }
      
      // 3. 动态导入Mock工具
      const mockModule = await import("@fhevm/mock-utils");
      console.log("✅ Mock module imported successfully");
      
      // 4. 构建完整的配置，包含必要的合约地址
      const config = {
        chainId: chainId,
        gatewayChainId: metadata.gatewayChainId || 55815,
        aclContractAddress: metadata.ACLAddress || "0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D",
        kmsContractAddress: metadata.KMSVerifierAddress || "0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC",
        inputVerifierContractAddress: metadata.InputVerifierAddress || "0x901F8942346f7AB3a01F6D7613119Bca447Bb030",
        verifyingContractAddressDecryption: "0x5ffdaAB0373E62E2ea2944776209aEf29E631A64",
        verifyingContractAddressInputVerification: "0x812b06e1CDCE800494b79fFE4f925A504a9A9810",
      };
      
      console.log("🔧 Using config for mock instance:", config);
      
      // 5. 创建Mock实例（需要传递两个provider参数）
      const mockInstance = await mockModule.MockFhevmInstance.create(provider, provider, config);

      console.log("✅ FHEVM Mock instance created successfully for local development");
      return mockInstance as unknown as MockFhevmInstance;
    } catch (error) {
      console.error("❌ Mock instance creation failed:", error);
      throw new FhevmSDKError(
        `Failed to create Mock instance: ${error}`,
        "MOCK_CREATION_ERROR",
        error
      );
    }
  }

  /**
   * 创建生产实例
   */
  private async createProductionInstance(
    provider: string | ethers.Eip1193Provider,
    chainId: number
  ): Promise<FhevmInstance> {
    // 确保SDK已加载和初始化
    if (!sdkLoader.isInitialized()) {
      await sdkLoader.loadSDK();
      await sdkLoader.initSDK();
    }

    const sdk = sdkLoader.getSDK();
    if (!sdk) {
      throw new FhevmSDKError("SDK not available", "SDK_NOT_AVAILABLE");
    }

    // 获取缓存的公钥和参数
    const aclAddress = sdk.SepoliaConfig.aclContractAddress;
    const { publicKey, publicParams } = await publicKeyStorage.get(aclAddress);

    // 构建实例配置
    const config: FhevmInstanceConfig = {
      ...sdk.SepoliaConfig,
      network: provider,
      publicKey: publicKey || undefined,
      publicParams: publicParams || undefined,
    };

    try {
      const instance = await sdk.createInstance(config);
      
      // 异步保存公钥和参数到缓存
      this.cachePublicData(instance, aclAddress).catch(console.warn);
      
      console.log("✅ Created FHEVM production instance");
      return instance;
    } catch (error) {
      throw new FhevmSDKError(
        `Failed to create production instance: ${error}`,
        "INSTANCE_CREATION_ERROR",
        error
      );
    }
  }

  /**
   * 缓存公钥和参数
   */
  private async cachePublicData(instance: FhevmInstance, aclAddress: string): Promise<void> {
    try {
      const publicKey = instance.getPublicKey();
      const publicParams = instance.getPublicParams(2048);
      
      if (publicKey && publicParams) {
        const publicKeyData = { id: aclAddress, data: publicKey.data };
        const publicParamsData = { "2048": publicParams };
        await publicKeyStorage.set(aclAddress, publicKeyData, publicParamsData);
      }
    } catch (error) {
      console.warn("Failed to cache public data:", error);
    }
  }

  /**
   * 创建FHEVM实例
   */
  async createInstance(
    provider: string | ethers.Eip1193Provider,
    options: {
      mockChains?: Record<number, string>;
      signal?: AbortSignal;
      onStatusChange?: (status: string) => void;
    } = {}
  ): Promise<FhevmInstance> {
    const { mockChains, signal, onStatusChange } = options;

    // 检查是否被中止
    if (signal?.aborted) {
      throw new Error("Operation aborted");
    }

    onStatusChange?.("resolving-network");

    // 解析网络信息
    const { rpcUrl, chainId, isMock } = await this.resolveNetworkInfo(provider, mockChains);

    if (signal?.aborted) throw new Error("Operation aborted");

    let instance: FhevmInstance;

    if (isMock) {
      onStatusChange?.("creating-mock-instance");
      instance = await this.createMockInstance(rpcUrl, chainId);
    } else {
      onStatusChange?.("creating-production-instance");
      instance = await this.createProductionInstance(provider, chainId);
    }

    if (signal?.aborted) throw new Error("Operation aborted");

    // 缓存实例和配置
    this.currentInstance = instance;
    
    // 获取实际的配置信息
    let actualConfig: any = {};
    if (isMock) {
      // 对于Mock实例，从relayer metadata获取地址
      try {
        const ethProvider = new ethers.JsonRpcProvider(rpcUrl);
        actualConfig = await ethProvider.send("fhevm_relayer_metadata", []);
      } catch (error) {
        console.warn("Failed to get relayer metadata for config:", error);
      }
    }
    
    this.currentConfig = {
      network: provider,
      chainId,
      aclContractAddress: actualConfig.ACLAddress || "",
      kmsContractAddress: actualConfig.KMSVerifierAddress || "",
      inputVerifierContractAddress: actualConfig.InputVerifierAddress || "",
      gatewayChainId: actualConfig.gatewayChainId || 0,
      relayerUrl: "",
    };

    onStatusChange?.("ready");
    return instance;
  }

  /**
   * 获取当前实例
   */
  getCurrentInstance(): FhevmInstance | null {
    return this.currentInstance;
  }

  /**
   * 获取当前配置
   */
  getCurrentConfig(): FhevmInstanceConfig | null {
    return this.currentConfig;
  }

  /**
   * 清理当前实例
   */
  clearInstance(): void {
    this.currentInstance = null;
    this.currentConfig = null;
  }

  /**
   * 检查实例是否与给定配置匹配
   */
  isInstanceValid(
    provider: string | ethers.Eip1193Provider,
    chainId?: number
  ): boolean {
    if (!this.currentInstance || !this.currentConfig) {
      return false;
    }

    // 检查provider是否匹配
    if (this.currentConfig.network !== provider) {
      return false;
    }

    // 检查chainId是否匹配（如果提供）
    if (chainId && this.currentConfig.chainId !== chainId) {
      return false;
    }

    return true;
  }
}

/**
 * 全局实例管理器
 */
export const instanceManager = FhevmInstanceManager.getInstance();

/**
 * 便捷函数：创建实例
 */
export async function createFhevmInstance(
  provider: string | ethers.Eip1193Provider,
  options?: {
    mockChains?: Record<number, string>;
    signal?: AbortSignal;
    onStatusChange?: (status: string) => void;
  }
): Promise<FhevmInstance> {
  return instanceManager.createInstance(provider, options);
}

/**
 * 便捷函数：获取当前实例
 */
export function getCurrentFhevmInstance(): FhevmInstance | null {
  return instanceManager.getCurrentInstance();
}

/**
 * 实例状态类型
 */
export type InstanceStatus = 
  | "idle" 
  | "resolving-network" 
  | "creating-mock-instance" 
  | "creating-production-instance" 
  | "ready" 
  | "error";

/**
 * 实例创建选项
 */
export interface CreateInstanceOptions {
  mockChains?: Record<number, string>;
  signal?: AbortSignal;
  onStatusChange?: (status: InstanceStatus) => void;
  forceRecreate?: boolean;
}
