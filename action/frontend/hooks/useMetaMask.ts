/**
 * MetaMask集成Hook
 * 处理钱包连接、账户管理和网络切换
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";

/**
 * MetaMask状态接口
 */
export interface MetaMaskState {
  isInstalled: boolean;
  isConnected: boolean;
  accounts: string[];
  chainId: number | undefined;
  provider: ethers.Eip1193Provider | undefined;
  signer: ethers.JsonRpcSigner | undefined;
  readOnlyProvider: ethers.JsonRpcProvider | undefined;
}

/**
 * MetaMask Hook返回值
 */
export interface UseMetaMaskReturn extends MetaMaskState {
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
  addNetwork: (networkConfig: NetworkConfig) => Promise<void>;
  isCorrectNetwork: (targetChainId: number) => boolean;
  error: string | null;
  isLoading: boolean;
}

/**
 * 网络配置接口
 */
export interface NetworkConfig {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls?: string[];
}

/**
 * 预定义的网络配置
 */
export const NETWORK_CONFIGS: Record<number, NetworkConfig> = {
  31337: {
    chainId: "0x7A69", // 31337 in hex
    chainName: "Localhost",
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: ["http://127.0.0.1:8545"],
  },
  11155111: {
    chainId: "0xAA36A7", // 11155111 in hex
    chainName: "Sepolia Testnet",
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: ["https://sepolia.infura.io/v3/YOUR_INFURA_KEY"],
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
  },
};

/**
 * MetaMask Hook实现
 */
export function useMetaMask(): UseMetaMaskReturn {
  // 状态管理
  const [state, setState] = useState<MetaMaskState>({
    isInstalled: false,
    isConnected: false,
    accounts: [],
    chainId: undefined,
    provider: undefined,
    signer: undefined,
    readOnlyProvider: undefined,
  });

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 引用管理
  const providerRef = useRef<ethers.BrowserProvider | null>(null);
  const listenersAttachedRef = useRef(false);

  /**
   * 检查MetaMask是否安装
   */
  const checkMetaMaskInstalled = useCallback(() => {
    return typeof window !== "undefined" && 
           typeof window.ethereum !== "undefined" && 
           window.ethereum.isMetaMask;
  }, []);

  /**
   * 获取账户信息
   */
  const getAccounts = useCallback(async (): Promise<string[]> => {
    if (!window.ethereum) return [];
    
    try {
      const accounts = await window.ethereum.request({ 
        method: "eth_accounts" 
      }) as string[];
      return accounts;
    } catch (error) {
      console.error("Failed to get accounts:", error);
      return [];
    }
  }, []);

  /**
   * 获取链ID
   */
  const getChainId = useCallback(async (): Promise<number | undefined> => {
    if (!window.ethereum) return undefined;
    
    try {
      const chainId = await window.ethereum.request({ 
        method: "eth_chainId" 
      }) as string;
      return parseInt(chainId, 16);
    } catch (error) {
      console.error("Failed to get chain ID:", error);
      return undefined;
    }
  }, []);

  /**
   * 更新状态
   */
  const updateState = useCallback(async () => {
    const isInstalled = checkMetaMaskInstalled();
    
    if (!isInstalled) {
      setState(prev => ({
        ...prev,
        isInstalled: false,
        isConnected: false,
        accounts: [],
        chainId: undefined,
        provider: undefined,
        signer: undefined,
      }));
      return;
    }

    const accounts = await getAccounts();
    const chainId = await getChainId();
    const isConnected = accounts.length > 0;

    let provider: ethers.Eip1193Provider | undefined;
    let signer: ethers.JsonRpcSigner | undefined;
    let readOnlyProvider: ethers.JsonRpcProvider | undefined;

    if (isConnected && window.ethereum) {
      provider = window.ethereum;
      
      if (!providerRef.current) {
        providerRef.current = new ethers.BrowserProvider(window.ethereum);
      }
      
      try {
        signer = await providerRef.current.getSigner();
      } catch (error) {
        console.warn("Failed to get signer:", error);
      }

      // 创建只读provider
      if (chainId === 31337) {
        readOnlyProvider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      } else if (chainId === 11155111) {
        readOnlyProvider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/YOUR_INFURA_KEY");
      }
    }

    setState({
      isInstalled,
      isConnected,
      accounts,
      chainId,
      provider,
      signer,
      readOnlyProvider,
    });
  }, [checkMetaMaskInstalled, getAccounts, getChainId]);

  /**
   * 连接MetaMask
   */
  const connect = useCallback(async () => {
    if (!checkMetaMaskInstalled()) {
      setError("MetaMask is not installed. Please install MetaMask to continue.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await window.ethereum!.request({ 
        method: "eth_requestAccounts" 
      });
      await updateState();
    } catch (error: any) {
      if (error.code === 4001) {
        setError("Connection rejected by user");
      } else {
        setError(`Failed to connect: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [checkMetaMaskInstalled, updateState]);

  /**
   * 断开连接
   */
  const disconnect = useCallback(() => {
    providerRef.current = null;
    setState(prev => ({
      ...prev,
      isConnected: false,
      accounts: [],
      provider: undefined,
      signer: undefined,
      readOnlyProvider: undefined,
    }));
  }, []);

  /**
   * 切换网络
   */
  const switchNetwork = useCallback(async (targetChainId: number) => {
    if (!window.ethereum) {
      setError("MetaMask is not available");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
    } catch (error: any) {
      if (error.code === 4902) {
        // 网络不存在，尝试添加
        const networkConfig = NETWORK_CONFIGS[targetChainId];
        if (networkConfig) {
          await addNetwork(networkConfig);
        } else {
          setError(`Network ${targetChainId} is not supported`);
        }
      } else {
        setError(`Failed to switch network: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 添加网络
   */
  const addNetwork = useCallback(async (networkConfig: NetworkConfig) => {
    if (!window.ethereum) {
      setError("MetaMask is not available");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [networkConfig],
      });
    } catch (error: any) {
      setError(`Failed to add network: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 检查是否在正确的网络
   */
  const isCorrectNetwork = useCallback((targetChainId: number) => {
    return state.chainId === targetChainId;
  }, [state.chainId]);

  /**
   * 设置事件监听器
   */
  useEffect(() => {
    if (!checkMetaMaskInstalled() || listenersAttachedRef.current) {
      return;
    }

    const handleAccountsChanged = (accounts: string[]) => {
      console.log("Accounts changed:", accounts);
      updateState();
    };

    const handleChainChanged = (chainId: string) => {
      console.log("Chain changed:", chainId);
      updateState();
    };

    const handleConnect = (connectInfo: { chainId: string }) => {
      console.log("Connected:", connectInfo);
      updateState();
    };

    const handleDisconnect = (error: { code: number; message: string }) => {
      console.log("Disconnected:", error);
      updateState();
    };

    // 添加事件监听器
    window.ethereum!.on("accountsChanged", handleAccountsChanged);
    window.ethereum!.on("chainChanged", handleChainChanged);
    window.ethereum!.on("connect", handleConnect);
    window.ethereum!.on("disconnect", handleDisconnect);

    listenersAttachedRef.current = true;

    // 清理函数
    return () => {
      if (window.ethereum && listenersAttachedRef.current) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
        window.ethereum.removeListener("connect", handleConnect);
        window.ethereum.removeListener("disconnect", handleDisconnect);
        listenersAttachedRef.current = false;
      }
    };
  }, [checkMetaMaskInstalled, updateState]);

  /**
   * 初始状态更新
   */
  useEffect(() => {
    updateState();
  }, [updateState]);

  return {
    ...state,
    connect,
    disconnect,
    switchNetwork,
    addNetwork,
    isCorrectNetwork,
    error,
    isLoading,
  };
}

/**
 * 扩展Window接口以支持ethereum
 */
declare global {
  interface Window {
    ethereum?: ethers.Eip1193Provider & {
      isMetaMask?: boolean;
      on: (event: string, handler: (...args: any[]) => void) => void;
      removeListener: (event: string, handler: (...args: any[]) => void) => void;
    };
  }
}
