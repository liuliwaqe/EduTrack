"use client";

import { useState, useEffect } from "react";
import { LoadingSpinner } from "./ui/LoadingSpinner";
import { useApp } from "@/app/providers";
import { useMetaMask } from "@/hooks/useMetaMask";
import { useFhevm } from "@/fhevm/useFhevm";
import { useMaskedAttendance } from "@/hooks/useMaskedAttendance";
import { getMaskedAttendanceAddress, MaskedAttendanceABI } from "@/abi";
import { ethers } from "ethers";

interface CourseInfo {
  id: string;
  name: string;
  teacher: string;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
  hasCheckedIn: boolean;
  canCheckIn: boolean;
}

export function StudentCheckIn() {
  const { addNotification, storage } = useApp();
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingInCourse, setCheckingInCourse] = useState<string | null>(null);

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
    registerAsStudent,
    checkUserRole,
    userRole,
    isContractReady,
    isLoading: contractLoading,
    error: contractError,
    getCourseDebugInfo,
  } = useMaskedAttendance({
    contractAddress,
    fhevmInstance,
    signer,
    readOnlyProvider,
    storage,
    chainId,
  });

  // 加载可签到的课程
  const loadAvailableCourses = async () => {
    if (!isContractReady || !readOnlyProvider || !signer) return;
    
    setIsLoading(true);
    try {
      const contract = new ethers.Contract(contractAddress!, MaskedAttendanceABI.abi, readOnlyProvider);
      const currentUserAddress = await signer.getAddress();
      const courseCount = await contract.nextCourseId();
      const availableCourses = [];
      const currentTime = Date.now();
      
      console.log("🔍 Student course loading debug:", {
        currentUserAddress,
        courseCount: courseCount.toString(),
        currentTime: new Date(currentTime).toLocaleString()
      });
      
      for (let i = 1; i < courseCount; i++) {
        try {
          const course = await contract.courses(i);
          const startTime = Number(course.startTime) * 1000;
          const endTime = Number(course.endTime) * 1000;
          
          console.log(`📚 Course ${i} details:`, {
            name: course.name,
            teacher: course.teacher,
            isActive: course.isActive,
            isFinalized: course.isFinalized,
            startTime: new Date(startTime).toLocaleString(),
            endTime: new Date(endTime).toLocaleString(),
            passesFilter: course.isActive && !course.isFinalized
          });
          
          if (course.isActive && !course.isFinalized) {
            // 检查是否已签到
            const hasChecked = await hasCheckedIn(i, currentUserAddress);
            
            // 判断是否可以签到（课程进行中且未签到）
            const canCheckIn = currentTime >= startTime && currentTime <= endTime && !hasChecked;
            
            console.log(`✅ Course ${i} added to student list:`, {
              canCheckIn,
              hasChecked,
              timeCheck: { currentTime: new Date(currentTime).toLocaleString(), inRange: currentTime >= startTime && currentTime <= endTime }
            });
            
            availableCourses.push({
              id: i.toString(),
              name: course.name,
              teacher: course.teacher,
              startTime: new Date(startTime),
              endTime: new Date(endTime),
              isActive: course.isActive,
              hasCheckedIn: hasChecked,
              canCheckIn: canCheckIn
            });
          }
        } catch (error) {
          // 课程不存在或无权访问
        }
      }
      
      setCourses(availableCourses);
    } catch (error) {
      console.error("Error loading courses:", error);
      addNotification({
        type: "error",
        title: "加载失败",
        message: "无法加载课程数据"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 学生签到
  const handleCheckIn = async (courseId: string, isAttending: boolean) => {
    console.log("🔥 HandleCheckIn called:", {
      courseId,
      isAttending,
      isContractReady,
      hasSigner: !!signer,
      hasFhevmInstance: !!fhevmInstance,
      hasCheckInFunction: typeof checkIn
    });

    if (!isContractReady || !signer) {
      addNotification({
        type: "error",
        title: "签到失败",
        message: "合约未就绪或钱包未连接"
      });
      return;
    }
    
    if (!checkIn) {
      addNotification({
        type: "error",
        title: "签到失败",
        message: "签到函数不可用"
      });
      return;
    }
    
    setCheckingInCourse(courseId);
    try {
      addNotification({
        type: "info",
        title: "正在签到",
        message: "请在钱包中确认签到交易..."
      });

      // 在调用前检查时间条件
      const course = courses.find(c => c.id === courseId);
      if (course) {
        const now = Date.now();
        const startTime = course.startTime.getTime();
        const endTime = course.endTime.getTime();
        
        console.log("⏰ Time check before checkIn:", {
          currentTime: new Date(now).toLocaleString(),
          courseStart: course.startTime.toLocaleString(),
          courseEnd: course.endTime.toLocaleString(),
          isInTimeRange: now >= startTime && now <= endTime,
          timeDiff: {
            fromStart: (now - startTime) / 1000 / 60, // 分钟
            toEnd: (endTime - now) / 1000 / 60 // 分钟
          }
        });
      }

      console.log("🔥 Calling checkIn function...");
      // 🔥 真实的加密签到交易
      await checkIn(Number(courseId), isAttending);
      console.log("🔥 CheckIn function completed successfully");
      
      addNotification({
        type: "success",
        title: "签到成功",
        message: `已成功${isAttending ? '出勤' : '请假'}签到`
      });
      
      // 重新加载课程数据
      loadAvailableCourses();
      
    } catch (error: any) {
      console.error("Check-in error:", error);
      let errorMessage = "签到失败";
      
      if (error.code === 4001) {
        errorMessage = "用户取消了交易";
      } else if (error.reason) {
        errorMessage = `合约错误: ${error.reason}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      addNotification({
        type: "error",
        title: "签到失败",
        message: errorMessage
      });
    } finally {
      setCheckingInCourse(null);
    }
  };

  useEffect(() => {
    loadAvailableCourses();
  }, [isContractReady]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">学生签到系统</h2>
          <p className="text-gray-600 mb-6">请先连接钱包以使用签到功能</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 头部 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">学生签到</h1>
          <p className="text-gray-600">查看课程并进行加密签到</p>
        </div>

        {/* 加载状态 */}
        {isLoading && (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {/* 学生注册提示 */}
        {isContractReady && !userRole.isStudent && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start">
                <div className="text-yellow-600 mr-2">⚠️</div>
                <div className="text-sm">
                  <p className="font-medium text-yellow-800 mb-1">需要学生注册</p>
                  <p className="text-yellow-700">
                    您还没有注册为学生，需要先注册才能使用签到功能。
                  </p>
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    await registerAsStudent();
                    addNotification({
                      type: "success",
                      title: "注册成功",
                      message: "您已成功注册为学生"
                    });
                    await checkUserRole(); // 重新检查用户角色
                  } catch (error: any) {
                    addNotification({
                      type: "error",
                      title: "注册失败",
                      message: error.message || "注册失败，请重试"
                    });
                  }
                }}
                disabled={contractLoading}
                className="btn btn-primary btn-sm"
              >
                {contractLoading ? <LoadingSpinner size="sm" /> : "自助注册"}
              </button>
            </div>
          </div>
        )}

        {contractError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="text-red-600 mr-2">⚠️</div>
              <div className="text-sm">
                <p className="font-medium text-red-800 mb-1">合约错误</p>
                <p className="text-red-700">{contractError}</p>
              </div>
            </div>
          </div>
        )}

        {/* 调试面板 */}
        {process.env.NODE_ENV === 'development' && isContractReady && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="text-sm">
                <p className="font-medium text-blue-800 mb-2">🔧 调试面板</p>
                <p className="text-blue-700">
                  合约地址: {contractAddress}
                </p>
                <p className="text-blue-700">
                  用户角色: {userRole.isStudent ? '学生' : userRole.isTeacher ? '教师' : '未注册'}
                </p>
              </div>
              <button
                onClick={async () => {
                  if (courses.length > 0) {
                    await getCourseDebugInfo(Number(courses[0].id));
                  }
                }}
                className="btn btn-sm btn-outline"
              >
                检查课程状态
              </button>
            </div>
          </div>
        )}

        {/* 课程列表 */}
        {!isLoading && (
          <div className="space-y-4">
            {courses.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">📚</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无可用课程</h3>
                <p className="text-gray-600">当前没有可以签到的课程</p>
                <div className="mt-4 text-sm text-gray-500">
                  <p>可能的原因：</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>没有活跃的课程</li>
                    <li>课程不在签到时间范围内</li>
                    <li>您还没有注册为学生</li>
                  </ul>
                </div>
              </div>
            ) : (
              courses.map((course) => {
                const now = Date.now();
                const isOngoing = now >= course.startTime.getTime() && now <= course.endTime.getTime();
                const isPast = now > course.endTime.getTime();
                const isFuture = now < course.startTime.getTime();
                
                return (
                  <div key={course.id} className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{course.name}</h3>
                        <p className="text-sm text-gray-600">教师: {course.teacher}</p>
                      </div>
                      
                      <div className="flex flex-col items-end space-y-2">
                        {/* 课程状态 */}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          isOngoing ? 'bg-green-100 text-green-800' :
                          isPast ? 'bg-gray-100 text-gray-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {isOngoing ? '🟢 进行中' : isPast ? '⚫ 已结束' : '🔵 未开始'}
                        </span>
                        
                        {/* 签到状态 */}
                        {course.hasCheckedIn && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            🔐 已签到(加密)
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* 时间信息 */}
                    <div className="text-sm text-gray-600 mb-4 space-y-1">
                      <p>📅 开始时间: {course.startTime.toLocaleString()}</p>
                      <p>📅 结束时间: {course.endTime.toLocaleString()}</p>
                    </div>
                    
                    {/* 签到按钮 */}
                    {course.canCheckIn && !course.hasCheckedIn && (
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleCheckIn(course.id, true)}
                          disabled={checkingInCourse === course.id}
                          className="btn btn-success flex-1"
                        >
                          {checkingInCourse === course.id ? <LoadingSpinner size="sm" /> : '✅ 出勤签到'}
                        </button>
                        <button
                          onClick={() => handleCheckIn(course.id, false)}
                          disabled={checkingInCourse === course.id}
                          className="btn btn-warning flex-1"
                        >
                          {checkingInCourse === course.id ? <LoadingSpinner size="sm" /> : '❌ 请假'}
                        </button>
                      </div>
                    )}
                    
                    {/* 签到提示 */}
                    {!course.canCheckIn && !course.hasCheckedIn && (
                      <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded">
                        {isFuture ? '⏰ 课程尚未开始' : 
                         isPast ? '⏰ 课程已结束' : 
                         '⏰ 不在签到时间内'}
                      </div>
                    )}
                    
                    {course.hasCheckedIn && (
                      <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded">
                        🔐 您已完成加密签到，出勤状态已加密存储在区块链上。
                        具体是出勤还是缺勤只有您和教师能够解密查看。
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
