// 自动生成的类型定义文件 - 请勿手动修改

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
