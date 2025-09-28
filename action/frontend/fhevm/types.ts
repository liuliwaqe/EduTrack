// FHEVM相关类型定义

import { ethers } from "ethers";

/**
 * FHEVM实例接口
 */
export interface FhevmInstance {
  createEncryptedInput(contractAddress: string, userAddress: string): EncryptedInput;
  decrypt(contractAddress: string, handle: string): Promise<bigint>;
  decryptPublic(contractAddress: string, handle: string): Promise<bigint>;
  userDecrypt(
    handles: Array<{ handle: string; contractAddress: string }>,
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: number,
    durationDays: number
  ): Promise<Record<string, bigint>>;
  generateKeypair(): { publicKey: string; privateKey: string };
  createEIP712(
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: number,
    durationDays: number
  ): EIP712Data;
  getPublicKey(): { id: string; data: string } | null;
  getPublicParams(size: number): string | null;
}

/**
 * 加密输入缓冲区接口
 */
export interface EncryptedInput {
  add8(value: bigint): void;
  add16(value: bigint): void;
  add32(value: bigint): void;
  add64(value: bigint): void;
  add128(value: bigint): void;
  add256(value: bigint): void;
  addBool(value: boolean): void;
  addAddress(value: string): void;
  encrypt(): Promise<{
    handles: string[];
    inputProof: string;
  }>;
}

/**
 * EIP712签名数据
 */
export interface EIP712Data {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: {
    UserDecryptRequestVerification: Array<{
      name: string;
      type: string;
    }>;
  };
  message: {
    publicKey: string;
    contractAddresses: string[];
    userAddress: string;
    startTimestamp: number;
    durationDays: number;
  };
}

/**
 * 解密签名参数
 */
export interface DecryptionSignature {
  publicKey: string;
  privateKey: string;
  signature: string;
  contractAddresses: string[];
  userAddress: string;
  startTimestamp: number;
  durationDays: number;
  eip712: EIP712Data;
}

/**
 * FHEVM实例配置
 */
export interface FhevmInstanceConfig {
  aclContractAddress: string;
  kmsContractAddress: string;
  inputVerifierContractAddress: string;
  chainId: number;
  gatewayChainId: number;
  network: string | ethers.Eip1193Provider;
  relayerUrl: string;
  publicKey?: {
    id: string;
    data: string;
  };
  publicParams?: {
    "2048": string;
  };
}

/**
 * FHEVM Hook状态
 */
export type FhevmStatus = "idle" | "loading" | "ready" | "error";

/**
 * FHEVM Hook参数
 */
export interface UseFhevmParams {
  provider: string | ethers.Eip1193Provider | undefined;
  chainId: number | undefined;
  enabled?: boolean;
  initialMockChains?: Record<number, string>;
}

/**
 * FHEVM Hook返回值
 */
export interface UseFhevmReturn {
  instance: FhevmInstance | undefined;
  refresh: () => void;
  error: Error | undefined;
  status: FhevmStatus;
}

/**
 * 存储接口
 */
export interface GenericStringStorage {
  getItem(key: string): string | Promise<string | null> | null;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

/**
 * Mock FHEVM实例（本地开发用）
 */
export interface MockFhevmInstance extends FhevmInstance {
  isMock: true;
}

/**
 * 窗口对象扩展（用于FHEVM SDK）
 */
export interface FhevmWindow extends Window {
  relayerSDK: {
    initSDK(options?: any): Promise<boolean>;
    createInstance(config: FhevmInstanceConfig): Promise<FhevmInstance>;
    SepoliaConfig: {
      aclContractAddress: string;
      kmsContractAddress: string;
      inputVerifierContractAddress: string;
      chainId: number;
      gatewayChainId: number;
      relayerUrl: string;
    };
    __initialized__?: boolean;
  };
}

/**
 * 加密值类型
 */
export interface EncryptedValue {
  handle: string;
  contractAddress: string;
}

/**
 * 解密结果类型
 */
export interface DecryptedResult {
  handle: string;
  value: bigint;
  timestamp: number;
}

/**
 * 课程相关类型
 */
export interface CourseData {
  id: number;
  name: string;
  teacher: string;
  startTime: number;
  endTime: number;
  isFinalized: boolean;
}

export interface AttendanceData {
  courseId: number;
  student: string;
  encryptedStatus: string; // 加密句柄
  timestamp: number;
  isSubmitted: boolean;
}

export interface CourseStatsData {
  totalStudents: number;
  attendedStudents: number;
  attendanceRate: number;
  isPublic: boolean;
}

/**
 * 用户角色类型
 */
export interface UserRole {
  isStudent: boolean;
  isTeacher: boolean;
  isAdmin: boolean;
}

/**
 * 应用状态类型
 */
export type LoadingState = "idle" | "loading" | "success" | "error";

export interface AppError {
  code: string;
  message: string;
  details?: any;
}

/**
 * 常量定义
 */
export const FHEVM_CONSTANTS = {
  SDK_CDN_URL: "https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs",
  SIGNATURE_DURATION_DAYS: 365,
  LOCAL_CHAIN_ID: 31337,
  SEPOLIA_CHAIN_ID: 11155111,
} as const;
