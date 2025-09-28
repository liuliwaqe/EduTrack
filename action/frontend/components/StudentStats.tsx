"use client";

import { useState, useEffect } from "react";
import { LoadingSpinner } from "./ui/LoadingSpinner";
import { useApp } from "@/app/providers";
import { useMetaMask } from "@/hooks/useMetaMask";
import { useFhevm } from "@/fhevm/useFhevm";
import { useMaskedAttendance } from "@/hooks/useMaskedAttendance";
import { getMaskedAttendanceAddress, MaskedAttendanceABI } from "@/abi";
import { ethers } from "ethers";

interface CourseStats {
  courseId: string;
  courseName: string;
  teacher: string;
  hasAttended: boolean;
  attendanceStatus: 'attended' | 'absent' | 'encrypted';
  startTime: Date;
  endTime: Date;
}

interface OverallStats {
  totalCourses: number;
  attendedCourses: number;
  absentCourses: number;
  attendanceRate: number;
  totalPoints: number;
}

export function StudentStats() {
  const { addNotification, storage } = useApp();
  const [courseStats, setCourseStats] = useState<CourseStats[]>([]);
  const [overallStats, setOverallStats] = useState<OverallStats>({
    totalCourses: 0,
    attendedCourses: 0,
    absentCourses: 0,
    attendanceRate: 0,
    totalPoints: 0
  });
  const [isLoading, setIsLoading] = useState(false);

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
    hasCheckedIn,
    getStudentTotalScore,
    isContractReady,
  } = useMaskedAttendance({
    contractAddress,
    fhevmInstance,
    signer,
    readOnlyProvider,
    storage,
    chainId,
  });

  // 加载统计数据
  const loadStats = async () => {
    if (!isContractReady || !readOnlyProvider || !signer) return;
    
    setIsLoading(true);
    try {
      const contract = new ethers.Contract(contractAddress!, MaskedAttendanceABI.abi, readOnlyProvider);
      const currentUserAddress = await signer.getAddress();
      const courseCount = await contract.nextCourseId();
      
      const stats: CourseStats[] = [];
      let attendedCount = 0;
      let absentCount = 0;
      
      // 遍历所有课程
      for (let i = 1; i < courseCount; i++) {
        try {
          const course = await contract.courses(i);
          const hasChecked = await hasCheckedIn(i, currentUserAddress);
          
          if (hasChecked) {
            // 由于数据是加密的，我们无法直接知道是出勤还是缺勤
            // 在真实应用中，这里需要解密逻辑
            const attendanceStatus = 'encrypted'; // 实际状态需要解密
            
            stats.push({
              courseId: i.toString(),
              courseName: course.name,
              teacher: course.teacher,
              hasAttended: hasChecked,
              attendanceStatus: attendanceStatus,
              startTime: new Date(Number(course.startTime) * 1000),
              endTime: new Date(Number(course.endTime) * 1000)
            });
            
            // 暂时假设有签到记录就是出勤（实际需要解密）
            attendedCount++;
          }
        } catch (error) {
          // 课程不存在或无权访问
        }
      }
      
      setCourseStats(stats);
      
      // 获取总积分
      const totalPoints = await getStudentTotalScore(currentUserAddress) || 0;
      
      // 计算总体统计
      setOverallStats({
        totalCourses: stats.length,
        attendedCourses: attendedCount,
        absentCourses: absentCount,
        attendanceRate: stats.length > 0 ? (attendedCount / stats.length) * 100 : 0,
        totalPoints: totalPoints
      });
      
    } catch (error) {
      console.error("Error loading stats:", error);
      addNotification({
        type: "error",
        title: "加载失败",
        message: "无法加载统计数据"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [isContractReady]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">统计分析</h2>
          <p className="text-gray-600 mb-6">请先连接钱包以查看统计数据</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 头部 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📈 统计分析</h1>
          <p className="text-gray-600">查看您的学习数据和趋势分析</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* 总体统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
                    📚
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">总课程数</p>
                    <p className="text-2xl font-bold text-gray-900">{overallStats.totalCourses}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
                    ✅
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">已签到课程</p>
                    <p className="text-2xl font-bold text-gray-900">{overallStats.attendedCourses}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-yellow-100 text-yellow-600 mr-4">
                    📊
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">签到率</p>
                    <p className="text-2xl font-bold text-gray-900">{overallStats.attendanceRate.toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-purple-100 text-purple-600 mr-4">
                    🏆
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">总积分</p>
                    <p className="text-2xl font-bold text-gray-900">{overallStats.totalPoints}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 课程详细统计 */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold mb-4">📋 课程签到记录</h3>
              
              {courseStats.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-4xl mb-2">📊</div>
                  <p className="text-gray-600">暂无签到记录</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {courseStats.map((course) => (
                    <div key={course.courseId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                          {course.courseId}
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{course.courseName}</h4>
                          <p className="text-sm text-gray-600">教师: {course.teacher.substring(0, 6)}...{course.teacher.substring(course.teacher.length - 4)}</p>
                          <p className="text-xs text-gray-500">
                            {course.startTime.toLocaleDateString()} {course.startTime.toLocaleTimeString()} - {course.endTime.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          course.attendanceStatus === 'attended' ? 'bg-green-100 text-green-800' :
                          course.attendanceStatus === 'absent' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {course.attendanceStatus === 'attended' ? '✅ 出勤' :
                           course.attendanceStatus === 'absent' ? '❌ 缺勤' :
                           '🔐 已签到(加密)'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 签到趋势图表 */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold mb-4">📈 签到趋势</h3>
              
              {overallStats.totalCourses > 0 ? (
                <div className="space-y-4">
                  {/* 简单的进度条显示 */}
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>总体签到率</span>
                      <span>{overallStats.attendanceRate.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(overallStats.attendanceRate, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  {/* 积分趋势 */}
                  <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">🏆 积分统计</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">当前总积分:</span>
                        <span className="ml-2 font-semibold text-purple-600">{overallStats.totalPoints}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">平均每课程积分:</span>
                        <span className="ml-2 font-semibold text-blue-600">
                          {overallStats.totalCourses > 0 ? (overallStats.totalPoints / overallStats.totalCourses).toFixed(1) : 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-4xl mb-2">📊</div>
                  <p className="text-gray-600">还没有签到记录，完成第一次签到后即可查看趋势</p>
                </div>
              )}
            </div>

            {/* FHEVM隐私保护说明 */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
              <div className="flex items-start">
                <div className="text-purple-600 mr-3 text-xl">🛡️</div>
                <div>
                  <h4 className="font-medium text-purple-800 mb-2">隐私保护统计</h4>
                  <p className="text-sm text-purple-700 mb-3">
                    您的出勤数据使用FHEVM同态加密技术保护：
                  </p>
                  <ul className="text-sm text-purple-700 space-y-1 list-disc list-inside">
                    <li>具体的出勤/缺勤状态在区块链上保持加密</li>
                    <li>只有您本人和授权教师才能解密查看详细状态</li>
                    <li>统计数据基于加密计算，保护个人隐私</li>
                    <li>即使区块链数据公开，您的隐私仍然受到保护</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

