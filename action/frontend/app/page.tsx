"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { WalletConnection } from "@/components/WalletConnection";
import { StudentMain } from "@/components/StudentMain";
import { TeacherDashboard } from "@/components/TeacherDashboard";
import { AdminDashboard } from "@/components/AdminDashboard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useMetaMask } from "@/hooks/useMetaMask";
import { useFhevm } from "@/fhevm/useFhevm";
import { useMaskedAttendance } from "@/hooks/useMaskedAttendance";
import { useApp } from "./providers";
import { getMaskedAttendanceAddress } from "@/abi";

/**
 * 主页面组件
 */
export default function HomePage() {
  const { addNotification } = useApp();
  const [contractAddress, setContractAddress] = useState<string | undefined>();

  // MetaMask集成
  const {
    isConnected,
    accounts,
    chainId,
    provider,
    signer,
    readOnlyProvider,
    connect,
    switchNetwork,
    error: walletError,
    isLoading: isWalletLoading,
  } = useMetaMask();

  // FHEVM集成
  const {
    instance: fhevmInstance,
    status: fhevmStatus,
    error: fhevmError,
    refresh: refreshFhevm,
  } = useFhevm({
    provider,
    chainId,
    enabled: !!provider && chainId === 31337, // 使用 provider 和 chainId 判断
    initialMockChains: { 31337: "http://127.0.0.1:8545" },
  });

  // 合约集成
  const {
    userRole,
    isLoading: isContractLoading,
    error: contractError,
    checkUserRole,
    isContractReady,
  } = useMaskedAttendance({
    contractAddress,
    fhevmInstance,
    signer,
    readOnlyProvider,
    storage: useApp().storage,
    chainId,
  });

  // 错误处理
  useEffect(() => {
    if (walletError) {
      addNotification({
        type: "error",
        title: "钱包错误",
        message: walletError,
      });
    }
  }, [walletError, addNotification]);

  useEffect(() => {
    if (fhevmError) {
      console.error("FHEVM Error Details:", fhevmError);
      addNotification({
        type: "error",
        title: "FHEVM错误",
        message: fhevmError.message,
      });
    }
  }, [fhevmError, addNotification]);

  useEffect(() => {
    if (contractError) {
      addNotification({
        type: "error",
        title: "合约错误",
        message: contractError,
      });
    }
  }, [contractError, addNotification]);

  // 网络检查
  useEffect(() => {
    if (isConnected && chainId && chainId !== 31337 && chainId !== 11155111) {
      addNotification({
        type: "warning",
        title: "网络不支持",
        message: "请切换到本地网络 (31337) 或 Sepolia 测试网 (11155111)",
      });
    }
  }, [isConnected, chainId, addNotification]);

  // 合约地址设置（从生成的地址文件中获取）
  useEffect(() => {
    if (chainId) {
      // 使用动态地址获取
      const address = getMaskedAttendanceAddress(chainId);
      if (address) {
        setContractAddress(address);
        console.log("✅ Set contract address for local network:", address);
        console.log("✅ Contract ready:", Boolean(address));
      } else if (chainId === 11155111) {
        // Sepolia地址（如果有部署的话）
        setContractAddress(undefined);
        console.log("⚠️ Sepolia network - no contract address set");
      }
    } else {
      console.log("⚠️ No chainId available");
    }
  }, [chainId]);

  // FHEVM状态提示
  useEffect(() => {
    console.log("🔍 Debug Info:", {
      fhevmStatus,
      fhevmInstance: !!fhevmInstance,
      chainId,
      isConnected,
      provider: !!provider,
      accounts: accounts.length
    });
    
    if (fhevmStatus === "ready" && fhevmInstance) {
      addNotification({
        type: "success",
        title: "FHEVM已就绪",
        message: "加密计算环境初始化完成",
        duration: 3000,
      });
    }
  }, [fhevmStatus, fhevmInstance, chainId, isConnected, provider, accounts, addNotification]);

  /**
   * 渲染主要内容
   */
  const renderMainContent = () => {
    // 如果未连接钱包
    if (!isConnected) {
      return (
        <WalletConnection 
          onConnect={connect}
          isLoading={isWalletLoading}
          error={walletError}
        />
      );
    }

    // 如果FHEVM未就绪
    if (fhevmStatus === "loading") {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <h2 className="mt-4 text-xl font-semibold text-gray-900">
              正在初始化FHEVM...
            </h2>
            <p className="mt-2 text-gray-600">
              请稍候，正在加载同态加密环境
            </p>
          </div>
        </div>
      );
    }

    // 如果FHEVM出错
    if (fhevmStatus === "error") {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              FHEVM初始化失败
            </h2>
            <p className="text-gray-600 mb-6">
              {fhevmError?.message || "未知错误"}
            </p>
            <button
              onClick={refreshFhevm}
              className="btn btn-primary"
            >
              重试
            </button>
          </div>
        </div>
      );
    }

    // 如果合约地址未设置
    if (!contractAddress) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">📄</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              合约未部署
            </h2>
            <p className="text-gray-600 mb-6">
              在当前网络 ({chainId}) 上未找到MaskedAttendance合约。
              请确保合约已正确部署。
            </p>
            {chainId !== 31337 && chainId !== 11155111 && (
              <button
                onClick={() => switchNetwork(31337)}
                className="btn btn-primary mr-3"
              >
                切换到本地网络
              </button>
            )}
          </div>
        </div>
      );
    }

    // 根据用户角色渲染相应的仪表板
    if (userRole.isAdmin) {
      return <AdminDashboard />;
    } else if (userRole.isTeacher) {
      return <TeacherDashboard />;
    } else if (userRole.isStudent) {
      return <StudentMain />;
    } else {
      // 用户未注册
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">👤</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              欢迎使用MaskedAttendance
            </h2>
            <p className="text-gray-600 mb-6">
              您尚未注册。请选择您的身份以开始使用系统。
            </p>
            <div className="space-y-3">
              <div className="text-xs text-gray-500 mb-4">
                <p>调试信息:</p>
                <p>链ID: {chainId}</p>
                <p>合约地址: {contractAddress || "未设置"}</p>
                <p>FHEVM状态: {fhevmStatus}</p>
                <p>合约就绪: {isContractReady ? "是" : "否"}</p>
              </div>
              
              <button
                onClick={async () => {
                  try {
                    console.log("Attempting student registration...");
                    console.log("Signer:", signer);
                    console.log("Contract address:", contractAddress);
                    
                    // 实现学生注册功能
                    if (signer && contractAddress) {
                      const contract = new ethers.Contract(
                        contractAddress,
                        ["function selfRegister() external"],
                        signer
                      );
                      const tx = await contract.selfRegister();
                      await tx.wait();
                      
                      addNotification({
                        type: "success",
                        title: "注册成功",
                        message: "您已成功注册为学生",
                      });
                      
                      // 刷新用户角色
                      checkUserRole();
                    } else {
                      addNotification({
                        type: "error",
                        title: "注册失败",
                        message: "缺少必要的依赖（signer或合约地址）",
                      });
                    }
                  } catch (error: any) {
                    console.error("Registration error:", error);
                    addNotification({
                      type: "error",
                      title: "注册失败",
                      message: error.message || "注册过程中出现错误",
                    });
                  }
                }}
                className="btn btn-primary w-full"
                disabled={isContractLoading || !contractAddress}
              >
                {isContractLoading ? <LoadingSpinner size="sm" /> : "注册为学生"}
              </button>
              <p className="text-sm text-gray-500">
                教师身份需要管理员授权
              </p>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen">
        {/* 页面头部 */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo和标题 */}
              <div className="flex items-center">
                <div className="text-2xl font-bold text-gradient">
                  🎓 MaskedAttendance
                </div>
                <div className="ml-4 text-sm text-gray-500">
                  隐私保护出勤系统
                </div>
              </div>

              {/* 状态指示器 */}
              <div className="flex items-center space-x-4">
                {/* 网络指示器 */}
                {isConnected && (
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      chainId === 31337 ? 'bg-green-500' :
                      chainId === 11155111 ? 'bg-blue-500' :
                      'bg-red-500'
                    }`} />
                    <span className="text-sm text-gray-600">
                      {chainId === 31337 ? 'Local' :
                       chainId === 11155111 ? 'Sepolia' :
                       `Chain ${chainId}`}
                    </span>
                  </div>
                )}

                {/* FHEVM状态 */}
                {isConnected && (
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      fhevmStatus === 'ready' ? 'bg-green-500' :
                      fhevmStatus === 'loading' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`} />
                    <span className="text-sm text-gray-600">
                      FHEVM {fhevmStatus === 'ready' ? '就绪' : 
                             fhevmStatus === 'loading' ? '加载中' : '错误'}
                    </span>
                  </div>
                )}

                {/* 用户地址 */}
                {isConnected && accounts[0] && (
                  <div className="text-sm text-gray-600">
                    {accounts[0].slice(0, 6)}...{accounts[0].slice(-4)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* 主要内容 */}
        {renderMainContent()}
      </div>
    </ErrorBoundary>
  );
}
