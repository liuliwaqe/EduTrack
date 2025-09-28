"use client";

import { LoadingSpinner } from "./ui/LoadingSpinner";

interface WalletConnectionProps {
  onConnect: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function WalletConnection({ onConnect, isLoading, error }: WalletConnectionProps) {
  const handleConnect = async () => {
    try {
      await onConnect();
    } catch (err) {
      console.error("Connection failed:", err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        {/* 主卡片 */}
        <div className="card text-center animate-fade-in-up">
          <div className="card-body">
            {/* Logo和标题 */}
            <div className="mb-8">
              <div className="text-6xl mb-4">🎓</div>
              <h1 className="text-3xl font-bold text-gradient mb-2">
                MaskedAttendance
              </h1>
              <p className="text-gray-600">
                基于FHEVM的隐私保护出勤系统
              </p>
            </div>

            {/* 特性介绍 */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center text-left">
                <div className="text-2xl mr-3">🔐</div>
                <div>
                  <h3 className="font-semibold text-gray-900">端到端加密</h3>
                  <p className="text-sm text-gray-600">出勤数据完全加密，保护隐私</p>
                </div>
              </div>
              
              <div className="flex items-center text-left">
                <div className="text-2xl mr-3">📊</div>
                <div>
                  <h3 className="font-semibold text-gray-900">同态统计</h3>
                  <p className="text-sm text-gray-600">无需解密即可进行数据统计</p>
                </div>
              </div>
              
              <div className="flex items-center text-left">
                <div className="text-2xl mr-3">🔒</div>
                <div>
                  <h3 className="font-semibold text-gray-900">区块链存储</h3>
                  <p className="text-sm text-gray-600">数据不可篡改，永久保存</p>
                </div>
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="error-container mb-6">
                <div className="error-title">连接失败</div>
                <div className="error-message">{error}</div>
              </div>
            )}

            {/* 连接按钮 */}
            <button
              onClick={handleConnect}
              disabled={isLoading}
              className="btn btn-primary btn-lg w-full"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" color="white" className="mr-2" />
                  连接中...
                </>
              ) : (
                <>
                  <span className="mr-2">🦊</span>
                  连接 MetaMask
                </>
              )}
            </button>

            {/* 帮助文本 */}
            <div className="mt-6 text-sm text-gray-500">
              <p className="mb-2">需要安装 MetaMask 钱包</p>
              <p>
                支持网络：本地开发网络 (31337) 和 Sepolia 测试网
              </p>
            </div>
          </div>
        </div>

        {/* MetaMask安装提示 */}
        {typeof window !== "undefined" && !window.ethereum && (
          <div className="mt-6 info-container">
            <div className="info-title">需要安装MetaMask</div>
            <div className="info-message">
              请先安装MetaMask浏览器扩展，然后刷新页面。
            </div>
            <div className="mt-3">
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-primary"
              >
                下载 MetaMask
              </a>
            </div>
          </div>
        )}

        {/* 开发者信息 */}
        <div className="mt-8 text-center text-xs text-gray-400">
          <p>MaskedAttendance v1.0.0</p>
          <p>基于 FHEVM 技术构建</p>
        </div>
      </div>
    </div>
  );
}
