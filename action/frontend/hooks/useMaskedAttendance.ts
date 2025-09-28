/**
 * MaskedAttendance合约交互Hook
 * 处理所有与智能合约相关的操作
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { FhevmInstance, GenericStringStorage } from "@/fhevm/types";
import { FhevmDecryptionSignatureManager } from "@/fhevm/decryption-signature";

// 导入生成的ABI和类型
import { MaskedAttendanceABI } from "@/abi/MaskedAttendanceABI";
import type { CourseInfo, CourseStats, UserRole } from "@/abi/types";

// 类型已从@/abi/types导入

/**
 * Hook参数接口
 */
export interface UseMaskedAttendanceParams {
  contractAddress: string | undefined;
  fhevmInstance: FhevmInstance | undefined;
  signer: ethers.Signer | undefined;
  readOnlyProvider: ethers.Provider | undefined;
  storage: GenericStringStorage;
  chainId: number | undefined;
}

/**
 * Hook返回值接口
 */
export interface UseMaskedAttendanceReturn {
  // 状态
  isLoading: boolean;
  error: string | null;
  userRole: UserRole;
  courses: CourseInfo[];
  currentCourse: CourseInfo | null;
  
  // 用户管理
  registerAsStudent: () => Promise<void>;
  checkUserRole: () => Promise<void>;
  
  // 课程管理
  createCourse: (name: string, startTime: number, endTime: number) => Promise<number>;
  getCourses: () => Promise<void>;
  getCourse: (courseId: number) => Promise<CourseInfo | null>;
  finalizeCourse: (courseId: number) => Promise<void>;
  
  // 签到功能
  checkIn: (courseId: number, isAttending: boolean) => Promise<void>;
  hasCheckedIn: (courseId: number, studentAddress?: string) => Promise<boolean>;
  getAttendanceStatus: (courseId: number, studentAddress?: string) => Promise<boolean | null>;
  
  // 统计功能
  getCourseStats: (courseId: number) => Promise<CourseStats | null>;
  getStudentTotalScore: (studentAddress?: string) => Promise<number | null>;
  
  // 工具函数
  refresh: () => void;
  isContractReady: boolean;

  // 内部引用
  signatureManagerRef: React.RefObject<FhevmDecryptionSignatureManager | null>;

  // 调试函数
  getCourseDebugInfo: (courseId: number) => Promise<any>;
}

// 使用生成的ABI
const MASKED_ATTENDANCE_ABI = MaskedAttendanceABI.abi;

/**
 * MaskedAttendance Hook实现
 */
export function useMaskedAttendance(params: UseMaskedAttendanceParams): UseMaskedAttendanceReturn {
  const {
    contractAddress,
    fhevmInstance,
    signer,
    readOnlyProvider,
    storage,
    chainId,
  } = params;

  // 状态管理
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole>({
    isStudent: false,
    isTeacher: false,
    isAdmin: false,
  });
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [currentCourse, setCurrentCourse] = useState<CourseInfo | null>(null);

  // 引用管理
  const contractRef = useRef<ethers.Contract | null>(null);
  const readOnlyContractRef = useRef<ethers.Contract | null>(null);
  const signatureManagerRef = useRef<FhevmDecryptionSignatureManager | null>(null);

  // 初始化合约实例
  useEffect(() => {
    if (contractAddress && signer) {
      contractRef.current = new ethers.Contract(contractAddress, MASKED_ATTENDANCE_ABI, signer);
    } else {
      contractRef.current = null;
    }

    if (contractAddress && readOnlyProvider) {
      readOnlyContractRef.current = new ethers.Contract(contractAddress, MASKED_ATTENDANCE_ABI, readOnlyProvider);
    } else {
      readOnlyContractRef.current = null;
    }
  }, [contractAddress, signer, readOnlyProvider]);

  // 初始化签名管理器
  useEffect(() => {
    if (storage) {
      signatureManagerRef.current = new FhevmDecryptionSignatureManager(storage);
    }
  }, [storage]);

  const isContractReady = Boolean(contractAddress && readOnlyContractRef.current);

  /**
   * 错误处理函数
   */
  const handleError = useCallback((error: any, operation: string) => {
    console.error(`${operation} failed:`, error);
    
    let errorMessage = `${operation} failed`;
    
    if (error.code === 4001) {
      errorMessage = "Transaction rejected by user";
    } else if (error.code === -32603) {
      errorMessage = "Internal JSON-RPC error";
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    setError(errorMessage);
  }, []);

  /**
   * 检查用户角色
   */
  const checkUserRole = useCallback(async () => {
    if (!readOnlyContractRef.current || !signer) return;

    try {
      const userAddress = await signer.getAddress();
      const [isStudent, isTeacher, adminAddress] = await Promise.all([
        readOnlyContractRef.current.isStudent(userAddress),
        readOnlyContractRef.current.isTeacher(userAddress),
        readOnlyContractRef.current.admin(),
      ]);

      setUserRole({
        isStudent,
        isTeacher,
        isAdmin: adminAddress.toLowerCase() === userAddress.toLowerCase(),
      });
    } catch (error) {
      handleError(error, "Check user role");
    }
  }, [signer, handleError]);

  /**
   * 学生自助注册
   */
  const registerAsStudent = useCallback(async () => {
    if (!contractRef.current) {
      setError("Contract not available");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tx = await contractRef.current.selfRegister();
      await tx.wait();
      
      // 更新用户角色
      await checkUserRole();
      
      console.log("✅ Successfully registered as student");
    } catch (error) {
      handleError(error, "Register as student");
    } finally {
      setIsLoading(false);
    }
  }, [checkUserRole, handleError]);

  /**
   * 创建课程
   */
  const createCourse = useCallback(async (
    name: string,
    startTime: number,
    endTime: number
  ): Promise<number> => {
    if (!contractRef.current) {
      throw new Error("Contract not available");
    }

    setIsLoading(true);
    setError(null);

    try {
      const tx = await contractRef.current.createCourse(name, startTime, endTime);
      const receipt = await tx.wait();
      
      // 从事件中获取课程ID
      const event = receipt.logs.find((log: any) => 
        log.topics[0] === ethers.id("CourseCreated(uint256,string,address)")
      );
      
      const courseId = event ? parseInt(event.topics[1], 16) : 0;
      
      console.log(`✅ Course created with ID: ${courseId}`);
      return courseId;
    } catch (error) {
      handleError(error, "Create course");
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  /**
   * 获取课程信息
   */
  const getCourse = useCallback(async (courseId: number): Promise<CourseInfo | null> => {
    if (!readOnlyContractRef.current) return null;

    try {
      const [name, teacher, startTime, endTime, isFinalized] = 
        await readOnlyContractRef.current.getCourseInfo(courseId);

      return {
        courseId,
        name,
        teacher,
        startTime: Number(startTime),
        endTime: Number(endTime),
        isFinalized,
      };
    } catch (error) {
      console.warn(`Failed to get course ${courseId}:`, error);
      return null;
    }
  }, []);

  /**
   * 加密签到
   */
  const checkIn = useCallback(async (courseId: number, isAttending: boolean) => {
    if (!contractRef.current || !fhevmInstance || !signer) {
      setError("Required dependencies not available");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const userAddress = await signer.getAddress();
      
      console.log("🔍 签到前检查:", {
        courseId,
        isAttending,
        userAddress,
        contractAddress
      });

      // 检查用户是否注册为学生
      const isStudentRegistered = await readOnlyContractRef.current?.isStudent(userAddress);
      console.log("👤 用户注册状态:", { isStudent: isStudentRegistered });
      
      if (!isStudentRegistered) {
        throw new Error("您还没有注册为学生，请先注册或联系管理员");
      }

      // 检查课程是否存在和状态
      const course = await readOnlyContractRef.current?.courses(courseId);
      console.log("📚 课程状态:", {
        courseId: course?.courseId?.toString(),
        isActive: course?.isActive,
        isFinalized: course?.isFinalized,
        startTime: new Date(Number(course?.startTime) * 1000).toLocaleString(),
        endTime: new Date(Number(course?.endTime) * 1000).toLocaleString(),
        currentTime: new Date().toLocaleString()
      });

      if (!course || course.courseId == 0) {
        throw new Error(`课程 ${courseId} 不存在`);
      }

      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime < Number(course.startTime)) {
        throw new Error("课程尚未开始");
      }
      if (currentTime > Number(course.endTime)) {
        throw new Error("课程已结束");
      }
      if (course.isFinalized) {
        throw new Error("课程已完结");
      }

      // 创建加密输入
      const input = fhevmInstance.createEncryptedInput(contractAddress!, userAddress);
      input.add8(BigInt(isAttending ? 1 : 2)); // 出勤状态：1=出勤, 2=缺席

      // 执行加密
      const encrypted = await input.encrypt();

      console.log("🔐 加密参数详细信息:", {
        用户操作: isAttending ? "点击了出勤按钮" : "点击了请假按钮",
        isAttending参数: isAttending,
        原始状态: isAttending ? "出勤" : "缺勤",
        发送到合约的加密值: isAttending ? 1 : 2,
        handles: encrypted.handles,
        inputProof: encrypted.inputProof ? "有证明" : "无证明"
      });

      // 调用合约
      console.log("🔥 准备调用checkIn合约方法:", {
        courseId,
        handle: encrypted.handles[0],
        hasProof: !!encrypted.inputProof,
        proofLength: encrypted.inputProof ? encrypted.inputProof.length : 0
      });

      const tx = await contractRef.current.checkIn(
        courseId,
        encrypted.handles[0], // 加密状态
        encrypted.inputProof   // 证明
      );

      console.log("🔥 交易已发送，等待确认...");
      const receipt = await tx.wait();
      console.log("✅ Successfully checked in, receipt:", receipt);
    } catch (error) {
      console.error("🚫 签到详细错误:", error);
      handleError(error, "Check in");
    } finally {
      setIsLoading(false);
    }
  }, [contractAddress, fhevmInstance, signer, handleError]);

  /**
   * 检查是否已签到
   */
  const hasCheckedIn = useCallback(async (
    courseId: number,
    studentAddress?: string
  ): Promise<boolean> => {
    if (!readOnlyContractRef.current || !signer) return false;

    try {
      const address = studentAddress || await signer.getAddress();
      
      // 检查加密的出勤记录
      const encryptedStatus = await readOnlyContractRef.current.encryptedAttendance(courseId, address);
      
      // 如果返回的不是零值，说明已经签到过
      // 在FHEVM中，未初始化的加密值通常为特定的零值
      const hasData = encryptedStatus && encryptedStatus !== "0x0000000000000000000000000000000000000000000000000000000000000000";
      
      console.log(`🔍 Attendance check for course ${courseId}:`, {
        address: address.substring(0, 6) + "..." + address.substring(address.length - 4),
        encryptedStatus: encryptedStatus ? encryptedStatus.substring(0, 10) + "..." : "null",
        hasData
      });
      
      return hasData;
    } catch (error) {
      console.warn("Failed to check attendance status:", error);
      return false;
    }
  }, [signer]);

  /**
   * 获取解密的出勤状态
   */
  const getAttendanceStatus = useCallback(async (
    courseId: number,
    studentAddress?: string
  ): Promise<boolean | null> => {
    if (!readOnlyContractRef.current || !fhevmInstance || !signer || !signatureManagerRef.current) {
      return null;
    }

    try {
      const address = studentAddress || await signer.getAddress();
      
      // 获取加密的出勤句柄
      const encryptedHandle = await readOnlyContractRef.current.getStudentAttendance(courseId, address);
      
      if (encryptedHandle === ethers.ZeroHash) {
        return null; // 未签到
      }

      console.log("🔑 开始获取解密签名...");

      // 获取解密签名
      const signature = await signatureManagerRef.current.getOrCreateSignature(
        fhevmInstance,
        [contractAddress!],
        signer
      );

      console.log("🔑 签名获取结果:", signature ? "成功" : "失败");

      if (!signature) {
        throw new Error("Failed to get decryption signature");
      }

      console.log("🔑 签名详情:", {
        hasPrivateKey: !!signature.privateKey,
        hasPublicKey: !!signature.publicKey,
        hasSignature: !!signature.signature,
        contractAddresses: signature.contractAddresses?.length || 0
      });

      // 解密
      const result = await fhevmInstance.userDecrypt(
        [{ handle: encryptedHandle, contractAddress: contractAddress! }],
        signature.privateKey,
        signature.publicKey,
        signature.signature,
        signature.contractAddresses,
        signature.userAddress,
        signature.startTimestamp,
        signature.durationDays
      );

      const decryptedValue = result[encryptedHandle];
      return decryptedValue === BigInt(1);
    } catch (error) {
      console.warn("Failed to decrypt attendance status:", error);
      return null;
    }
  }, [contractAddress, fhevmInstance, signer]);

  /**
   * 结束课程
   */
  const finalizeCourse = useCallback(async (courseId: number) => {
    if (!contractRef.current) {
      setError("Contract not available");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tx = await contractRef.current.finalizeCourse(courseId);
      await tx.wait();
      console.log("✅ Course finalized");
    } catch (error) {
      handleError(error, "Finalize course");
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  /**
   * 获取课程统计
   */
  const getCourseStats = useCallback(async (courseId: number): Promise<CourseStats | null> => {
    if (!readOnlyContractRef.current) return null;

    try {
      const [totalStudents, attendedStudents, attendanceRate, isPublic] = 
        await readOnlyContractRef.current.getCourseStats(courseId);

      return {
        totalStudents: Number(totalStudents),
        attendedStudents: Number(attendedStudents),
        attendanceRate: Number(attendanceRate),
        isPublic,
      };
    } catch (error) {
      console.warn("Failed to get course stats:", error);
      return null;
    }
  }, []);

  /**
   * 获取学生总分（需要解密）
   */
  const getStudentTotalScore = useCallback(async (
    studentAddress?: string
  ): Promise<number | null> => {
    if (!readOnlyContractRef.current || !fhevmInstance || !signer || !signatureManagerRef.current) {
      return null;
    }

    try {
      const address = studentAddress || await signer.getAddress();
      
      // 获取加密分数句柄
      const encryptedHandle = await readOnlyContractRef.current.getStudentScore(address);

      // 检查是否是有效的加密句柄
      console.log("🔍 获取到的积分句柄:", encryptedHandle);

      if (encryptedHandle === ethers.ZeroHash ||
          encryptedHandle === "0x0000000000000000000000000000000000000000000000000000000000000000" ||
          encryptedHandle === "0x") {
        console.log("积分句柄无效，返回0分");
        return 0;
      }

      console.log("🔑 开始获取解密签名...");

      // 获取解密签名
      const signature = await signatureManagerRef.current.getOrCreateSignature(
        fhevmInstance,
        [contractAddress!],
        signer
      );

      console.log("🔑 签名获取结果:", signature ? "成功" : "失败");

      if (!signature) {
        throw new Error("Failed to get decryption signature");
      }

      console.log("🔑 签名详情:", {
        hasPrivateKey: !!signature.privateKey,
        hasPublicKey: !!signature.publicKey,
        hasSignature: !!signature.signature,
        contractAddresses: signature.contractAddresses?.length || 0
      });

      // 解密
      const result = await fhevmInstance.userDecrypt(
        [{ handle: encryptedHandle, contractAddress: contractAddress! }],
        signature.privateKey,
        signature.publicKey,
        signature.signature,
        signature.contractAddresses,
        signature.userAddress,
        signature.startTimestamp,
        signature.durationDays
      );

      const decryptedValue = result[encryptedHandle];
      const score = Number(decryptedValue);
      console.log("🔓 解密成功，积分:", score);
      console.log("🔍 解密过程详情:", {
        encryptedHandle,
        decryptedValue,
        signature: signature ? "已生成" : "未生成"
      });
      return score;
    } catch (error) {
      console.warn("Failed to decrypt student score:", error);
      console.log("⚠️ 解密失败，返回null让前端处理");
      return null; // 返回null，让前端知道解密失败
    }
  }, [contractAddress, fhevmInstance, signer]);

  /**
   * 获取课程列表（简化版）
   */
  const getCourses = useCallback(async () => {
    // 这里需要根据实际合约实现来获取课程列表
    // 可能需要监听事件或者维护一个课程索引
    console.log("Getting courses...");
  }, []);

  /**
   * 获取课程调试信息
   */
  const getCourseDebugInfo = useCallback(async (courseId: number): Promise<any> => {
    if (!readOnlyContractRef.current) return null;

    try {
      const debugInfo = await readOnlyContractRef.current.getCourseDebugInfo(courseId);
      console.log(`🔍 Course ${courseId} debug info:`, {
        name: debugInfo[0],
        teacher: debugInfo[1],
        startTime: new Date(Number(debugInfo[2]) * 1000).toLocaleString(),
        endTime: new Date(Number(debugInfo[3]) * 1000).toLocaleString(),
        isActive: debugInfo[4],
        isFinalized: debugInfo[5],
        currentTime: new Date(Number(debugInfo[6]) * 1000).toLocaleString(),
        canCheckIn: debugInfo[7]
      });
      return debugInfo;
    } catch (error) {
      console.warn(`Failed to get debug info for course ${courseId}:`, error);
      return null;
    }
  }, []);


  /**
   * 刷新数据
   */
  const refresh = useCallback(() => {
    checkUserRole();
    getCourses();
  }, [checkUserRole, getCourses]);

  // 初始化时检查用户角色
  useEffect(() => {
    if (isContractReady && signer) {
      checkUserRole();
    }
  }, [isContractReady, signer, checkUserRole]);

  return {
    isLoading,
    error,
    userRole,
    courses,
    currentCourse,

    registerAsStudent,
    checkUserRole,

    createCourse,
    getCourses,
    getCourse,
    finalizeCourse,

    checkIn,
    hasCheckedIn,
    getAttendanceStatus,

    getCourseStats,
    getStudentTotalScore,

    refresh,
    isContractReady,

    // 内部引用（用于高级功能）
    signatureManagerRef,

    // 调试函数
    getCourseDebugInfo,
  };
}
