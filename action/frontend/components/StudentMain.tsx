"use client";

import { useState } from "react";
import { StudentDashboard } from "./StudentDashboard";
import { StudentCheckIn } from "./StudentCheckIn";
import { StudentPoints } from "./StudentPoints";
import { StudentStats } from "./StudentStats";

type StudentTab = 'dashboard' | 'checkin' | 'points' | 'stats';

export function StudentMain() {
  const [activeTab, setActiveTab] = useState<StudentTab>('checkin');

  const tabs = [
    { id: 'checkin' as StudentTab, label: '📝 课程签到', icon: '📝' },
    { id: 'points' as StudentTab, label: '🏆 我的积分', icon: '🏆' },
    { id: 'dashboard' as StudentTab, label: '📊 学习概览', icon: '📊' },
    { id: 'stats' as StudentTab, label: '📈 统计分析', icon: '📈' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'checkin':
        return <StudentCheckIn />;
      case 'points':
        return <StudentPoints />;
      case 'dashboard':
        return <StudentDashboard />;
      case 'stats':
        return <StudentStats />;
      default:
        return <StudentCheckIn />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航标签 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1">
        {renderContent()}
      </div>
    </div>
  );
}
