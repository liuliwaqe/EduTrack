#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 路径配置
const CONTRACTS_DIR = path.resolve(__dirname, "../../contracts");
const ARTIFACTS_DIR = path.join(CONTRACTS_DIR, "artifacts/src");
const DEPLOYMENTS_DIR = path.join(CONTRACTS_DIR, "deployments");
const OUTPUT_DIR = path.resolve(__dirname, "../abi");

console.log("🔧 Generating ABI files...");

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * 生成ABI文件
 */
function generateABI() {
  const artifactPath = path.join(ARTIFACTS_DIR, "MaskedAttendance.sol/MaskedAttendance.json");
  
  if (!fs.existsSync(artifactPath)) {
    console.warn("⚠️  MaskedAttendance artifact not found. Please compile contracts first.");
    console.warn(`   Expected: ${artifactPath}`);
    return;
  }

  try {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    
    const abiContent = `// 自动生成的ABI文件 - 请勿手动修改
// Generated from: ${artifactPath}

export const MaskedAttendanceABI = {
  abi: ${JSON.stringify(artifact.abi, null, 2)},
  bytecode: "${artifact.bytecode}",
  contractName: "MaskedAttendance",
  sourceName: "src/MaskedAttendance.sol",
} as const;

export type MaskedAttendanceABIType = typeof MaskedAttendanceABI;
`;

    fs.writeFileSync(path.join(OUTPUT_DIR, "MaskedAttendanceABI.ts"), abiContent);
    console.log("✅ Generated MaskedAttendanceABI.ts");
  } catch (error) {
    console.error("❌ Error generating ABI:", error.message);
  }
}

/**
 * 生成地址文件
 */
function generateAddresses() {
  const addresses = {};

  // 检查部署文件
  if (fs.existsSync(DEPLOYMENTS_DIR)) {
    const networks = fs.readdirSync(DEPLOYMENTS_DIR).filter(item => 
      fs.statSync(path.join(DEPLOYMENTS_DIR, item)).isDirectory()
    );

    for (const network of networks) {
      const deploymentFile = path.join(DEPLOYMENTS_DIR, network, "MaskedAttendance.json");
      
      if (fs.existsSync(deploymentFile)) {
        try {
          const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
          
          // 确定链ID
          let chainId;
          if (network === "localhost") {
            chainId = "31337";
          } else if (network === "sepolia") {
            chainId = "11155111";
          } else {
            chainId = network;
          }

          addresses[chainId] = {
            address: deployment.address,
            chainId: parseInt(chainId),
            chainName: network,
            blockNumber: deployment.receipt?.blockNumber || 0,
            transactionHash: deployment.transactionHash || "",
          };
        } catch (error) {
          console.warn(`⚠️  Error reading deployment for ${network}:`, error.message);
        }
      }
    }
  }

  const addressContent = `// 自动生成的地址文件 - 请勿手动修改
// Generated from deployments directory

export const MaskedAttendanceAddresses = ${JSON.stringify(addresses, null, 2)} as const;

export type MaskedAttendanceAddressesType = typeof MaskedAttendanceAddresses;

// 辅助函数：根据链ID获取合约地址
export function getMaskedAttendanceAddress(chainId: number): string | undefined {
  const deployment = MaskedAttendanceAddresses[chainId.toString() as keyof typeof MaskedAttendanceAddresses];
  return deployment?.address;
}

// 辅助函数：检查链是否支持
export function isChainSupported(chainId: number): boolean {
  return chainId.toString() in MaskedAttendanceAddresses;
}
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, "MaskedAttendanceAddresses.ts"), addressContent);
  console.log("✅ Generated MaskedAttendanceAddresses.ts");
  
  if (Object.keys(addresses).length === 0) {
    console.warn("⚠️  No deployments found. Deploy contracts first to generate addresses.");
  } else {
    console.log(`📍 Found deployments for chains: ${Object.keys(addresses).join(", ")}`);
  }
}

/**
 * 生成类型定义文件
 */
function generateTypes() {
  const typesContent = `// 自动生成的类型定义文件 - 请勿手动修改

export interface CourseInfo {
  courseId: number;
  name: string;
  teacher: string;
  startTime: number;
  endTime: number;
  isFinalized: boolean;
}

export interface CourseStats {
  totalStudents: number;
  attendedStudents: number;
  attendanceRate: number;
  isPublic: boolean;
}

export interface AttendanceRecord {
  status: string; // 加密句柄
  timestamp: number;
  isSubmitted: boolean;
}

export interface UserRole {
  isStudent: boolean;
  isTeacher: boolean;
  isAdmin: boolean;
}

// FHEVM相关类型
export interface EncryptedValue {
  handle: string;
  proof: string;
}

export interface DecryptedValue {
  value: bigint | boolean | string;
  handle: string;
}

// 前端状态类型
export type LoadingState = "idle" | "loading" | "success" | "error";

export interface AppState {
  user: {
    address: string;
    role: UserRole;
    isConnected: boolean;
  };
  courses: CourseInfo[];
  currentCourse?: CourseInfo;
  loadingState: LoadingState;
  error?: string;
}
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, "types.ts"), typesContent);
  console.log("✅ Generated types.ts");
}

/**
 * 生成索引文件
 */
function generateIndex() {
  const indexContent = `// 自动生成的索引文件 - 请勿手动修改

export * from "./MaskedAttendanceABI";
export * from "./MaskedAttendanceAddresses";
export * from "./types";
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, "index.ts"), indexContent);
  console.log("✅ Generated index.ts");
}

// 执行生成
try {
  generateABI();
  generateAddresses();
  generateTypes();
  generateIndex();
  
  console.log("\n🎉 ABI generation completed successfully!");
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
} catch (error) {
  console.error("\n❌ ABI generation failed:", error.message);
  process.exit(1);
}
