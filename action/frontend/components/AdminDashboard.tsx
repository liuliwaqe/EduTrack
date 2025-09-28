"use client";

export function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">管理员仪表板</h1>
          <p className="text-gray-600 mb-8">系统管理和用户权限控制</p>
          
          <div className="card max-w-md mx-auto">
            <div className="card-body text-center">
              <div className="text-6xl mb-4">👑</div>
              <h2 className="text-xl font-semibold mb-2">功能开发中</h2>
              <p className="text-gray-600">管理员功能即将推出，敬请期待！</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
