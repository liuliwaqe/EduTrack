"use client";

import { useState, useEffect } from "react";
import { LoadingSpinner } from "./ui/LoadingSpinner";
import { useApp } from "@/app/providers";
import { useMetaMask } from "@/hooks/useMetaMask";
import { useFhevm } from "@/fhevm/useFhevm";
import { useMaskedAttendance } from "@/hooks/useMaskedAttendance";
import { getMaskedAttendanceAddress, MaskedAttendanceABI } from "@/abi";
import { ethers } from "ethers";

// 模拟数据接口
interface Course {
  id: number;
  name: string;
  teacher: string;
  startTime: number;
  endTime: number;
  hasCheckedIn: boolean;
  attendanceStatus?: boolean; // true=出勤, false=缺席, undefined=未知
}

interface StudentStats {
  totalCourses: number;
  attendedCourses: number;
  attendanceRate: number;
  totalScore: number;
}

export function StudentDashboard() {
  const { addNotification, storage } = useApp();
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<StudentStats>({
    totalCourses: 0,
    attendedCourses: 0,
    attendanceRate: 0,
    totalScore: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [checkingInCourse, setCheckingInCourse] = useState<number | null>(null);

  // 获取钱包连接
  const {
    isConnected,
    chainId,
    provider,
    signer,
    readOnlyProvider,
  } = useMetaMask();

  // 获取FHEVM实例
  const {
    instance: fhevmInstance,
  } = useFhevm({
    provider,
    chainId,
    enabled: !!provider && chainId === 31337,
    initialMockChains: { 31337: "http://127.0.0.1:8545" },
  });

  // 获取合约地址
  const contractAddress = chainId ? getMaskedAttendanceAddress(chainId) : undefined;

  // 获取合约实例和方法
  const { 
    checkIn,
    hasCheckedIn,
    getStudentTotalScore,
    isContractReady,
    isLoading: contractLoading,
    error: contractError
  } = useMaskedAttendance({
    contractAddress,
    fhevmInstance,
    signer,
    readOnlyProvider,
    storage,
    chainId,
  });

  // 加载真实数据
  useEffect(() => {
    if (isContractReady && readOnlyProvider && contractAddress) {
      loadData();
    }
  }, [isContractReady, contractAddress]);

  const loadData = async () => {
    if (!isContractReady || !readOnlyProvider || !signer) return;

    setIsLoading(true);
    try {
      const currentUserAddress = await signer.getAddress();

      // 创建合约实例
      const contract = new ethers.Contract(contractAddress!, MaskedAttendanceABI.abi, readOnlyProvider);

      // 获取课程数量
      const courseCount = await contract.nextCourseId();
      
      console.log("📚 学生仪表板加载调试:", {
        currentUserAddress,
        courseCount: courseCount.toString(),
        contractAddress
      });

      // 加载所有课程信息
      const loadedCourses: Course[] = [];
      let attendedCourses = 0;

      for (let i = 1; i < courseCount; i++) {
        try {
          const course = await contract.courses(i);
          const currentTime = Math.floor(Date.now() / 1000);

          // 检查是否已签到
          const hasChecked = await hasCheckedIn(i, currentUserAddress);
          let attendanceStatus: boolean | undefined;

          if (hasChecked) {
            // TODO: 获取出勤状态（需要解密）
            attendanceStatus = true; // 暂时假设已签到就是出勤
            attendedCourses++;
          }

          loadedCourses.push({
            id: Number(course.courseId),
            name: course.name,
            teacher: course.teacher,
            startTime: Number(course.startTime) * 1000,
            endTime: Number(course.endTime) * 1000,
            hasCheckedIn: hasChecked,
            attendanceStatus: attendanceStatus,
          });
        } catch (error) {
          // 课程不存在，跳过
          console.warn(`课程 ${i} 加载失败:`, error);
        }
      }

      setCourses(loadedCourses);

      // 计算真实统计数据
      const totalCourses = loadedCourses.length;
      const attendanceRate = totalCourses > 0 ? (attendedCourses / totalCourses) * 100 : 0;

      // 获取真实积分
      const realScore = await getStudentTotalScore(currentUserAddress);

      setStats({
        totalCourses: totalCourses,
        attendedCourses: attendedCourses,
        attendanceRate: Number(attendanceRate.toFixed(1)),
        totalScore: typeof realScore === 'number' ? realScore : 0,
      });

      console.log("📊 学生仪表板数据加载完成:", {
        totalCourses,
        attendedCourses,
        attendanceRate,
        totalScore: realScore
      });

    } catch (error) {
      console.error("加载学生数据失败:", error);
      addNotification({
        type: "error",
        title: "加载失败",
        message: "无法加载学生数据，请稍后重试"
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 处理签到
   */
  const handleCheckIn = async (courseId: number, isAttending: boolean = true) => {
    setCheckingInCourse(courseId);

    try {
      console.log(`🔥 开始签到 - 课程ID: ${courseId}, 出勤状态: ${isAttending}`);

      // 调用真实的签到函数
      await checkIn(courseId, isAttending);

      // 重新加载数据以更新状态
      await loadData();

      addNotification({
        type: "success",
        title: "签到成功",
        message: `已成功签到 ${isAttending ? '出勤' : '缺席'}`,
      });

    } catch (error: any) {
      console.error("签到失败:", error);
      addNotification({
        type: "error",
        title: "签到失败",
        message: error.message || "签到过程中出现错误，请重试",
      });
    } finally {
      setCheckingInCourse(null);
    }
  };

  /**
   * 获取课程状态
   */
  const getCourseStatus = (course: Course) => {
    const now = Date.now();
    
    if (course.hasCheckedIn) {
      return course.attendanceStatus ? 'present' : 'absent';
    }
    
    if (now < course.startTime) {
      return 'upcoming';
    } else if (now > course.endTime) {
      return 'missed';
    } else {
      return 'active';
    }
  };

  /**
   * 获取状态显示文本
   */
  const getStatusText = (status: string) => {
    switch (status) {
      case 'present': return '已出勤';
      case 'absent': return '已缺席';
      case 'upcoming': return '即将开始';
      case 'active': return '正在进行';
      case 'missed': return '已错过';
      default: return '未知';
    }
  };

  /**
   * 获取状态样式
   */
  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'present': return 'status-success';
      case 'absent': return 'status-error';
      case 'upcoming': return 'status-info';
      case 'active': return 'status-warning';
      case 'missed': return 'status-error';
      default: return 'status-info';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">正在加载学生数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">学生仪表板</h1>
          <p className="text-gray-600">管理您的课程出勤和查看统计数据</p>
        </div>

        {/* 统计卡片 */}
        <div className="responsive-grid mb-8">
          <div className="card">
            <div className="card-body text-center">
              <div className="text-3xl font-bold text-primary-600 mb-2">
                {stats.totalCourses}
              </div>
              <div className="text-gray-600">总课程数</div>
            </div>
          </div>

          <div className="card">
            <div className="card-body text-center">
              <div className="text-3xl font-bold text-success-600 mb-2">
                {stats.attendedCourses}
              </div>
              <div className="text-gray-600">已出勤课程</div>
            </div>
          </div>

          <div className="card">
            <div className="card-body text-center">
              <div className="text-3xl font-bold text-education-blue mb-2">
                {stats.attendanceRate}%
              </div>
              <div className="text-gray-600">出勤率</div>
            </div>
          </div>

          <div className="card">
            <div className="card-body text-center">
              <div className="text-3xl font-bold text-education-green mb-2">
                {stats.totalScore}
              </div>
              <div className="text-gray-600">总积分</div>
            </div>
          </div>
        </div>

        {/* 课程列表 */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-xl font-semibold text-gray-900">我的课程</h2>
          </div>
          <div className="card-body">
            {courses.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📚</div>
                <div className="empty-state-title">暂无课程</div>
                <div className="empty-state-description">
                  您还没有注册任何课程
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {courses.map(course => {
                  const status = getCourseStatus(course);
                  const canCheckIn = status === 'active' && !course.hasCheckedIn;
                  const isCheckingIn = checkingInCourse === course.id;

                  return (
                    <div key={course.id} className="course-card">
                      <div className="card-body">
                        <div className="flex items-center justify-between">
                          {/* 课程信息 */}
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">
                              {course.name}
                            </h3>
                            <p className="text-gray-600 mb-2">
                              教师: {course.teacher}
                            </p>
                            <div className="text-sm text-gray-500">
                              {new Date(course.startTime).toLocaleString()} - 
                              {new Date(course.endTime).toLocaleString()}
                            </div>
                          </div>

                          {/* 状态和操作 */}
                          <div className="flex items-center space-x-4">
                            {/* 状态标签 */}
                            <span className={`status-indicator ${getStatusStyles(status)}`}>
                              {getStatusText(status)}
                            </span>

                            {/* 签到按钮 */}
                            {canCheckIn && (
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleCheckIn(course.id, true)}
                                  disabled={isCheckingIn}
                                  className="btn btn-success btn-sm"
                                >
                                  {isCheckingIn ? (
                                    <LoadingSpinner size="sm" color="white" />
                                  ) : (
                                    '✓ 出勤'
                                  )}
                                </button>
                                <button
                                  onClick={() => handleCheckIn(course.id, false)}
                                  disabled={isCheckingIn}
                                  className="btn btn-secondary btn-sm"
                                >
                                  {isCheckingIn ? (
                                    <LoadingSpinner size="sm" />
                                  ) : (
                                    '✗ 缺席'
                                  )}
                                </button>
                              </div>
                            )}

                            {/* 已签到显示 */}
                            {course.hasCheckedIn && (
                              <div className="text-sm text-gray-500">
                                {course.attendanceStatus ? (
                                  <span className="text-success-600">✓ 已签到出勤</span>
                                ) : (
                                  <span className="text-red-600">✗ 已签到缺席</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 帮助信息 */}
        <div className="mt-8 info-container">
          <div className="info-title">💡 使用提示</div>
          <div className="info-message">
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>只能在课程进行期间签到</li>
              <li>每门课程只能签到一次</li>
              <li>出勤数据采用端到端加密保护</li>
              <li>签到记录将永久保存在区块链上</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
