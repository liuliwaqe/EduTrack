/**
 * FHEVM React Hook
 * 管理FHEVM实例的生命周期和状态
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import { 
  FhevmInstance, 
  FhevmStatus, 
  UseFhevmParams, 
  UseFhevmReturn 
} from "./types";
import { createFhevmInstance, instanceManager } from "./instance-manager";
import { FhevmSDKError } from "./sdk-loader";

/**
 * FHEVM Hook实现
 */
export function useFhevm(params: UseFhevmParams): UseFhevmReturn {
  const { provider, chainId, enabled = true, initialMockChains } = params;

  // 状态管理
  const [instance, setInstance] = useState<FhevmInstance | undefined>(undefined);
  const [status, setStatus] = useState<FhevmStatus>("idle");
  const [error, setError] = useState<Error | undefined>(undefined);
  const [retryCount, setRetryCount] = useState(0);

  // 引用管理
  const abortControllerRef = useRef<AbortController | null>(null);
  const providerRef = useRef(provider);
  const chainIdRef = useRef(chainId);
  const enabledRef = useRef(enabled);
  const mockChainsRef = useRef(initialMockChains);

  // 更新引用
  useEffect(() => {
    providerRef.current = provider;
    chainIdRef.current = chainId;
    enabledRef.current = enabled;
    mockChainsRef.current = initialMockChains;
  }, [provider, chainId, enabled, initialMockChains]);

  /**
   * 刷新实例
   */
  const refresh = useCallback(() => {
    // 取消当前操作
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 清理当前实例
    instanceManager.clearInstance();
    setInstance(undefined);
    setError(undefined);
    setStatus("idle");
    setRetryCount(0); // 重置重试计数

    // 如果提供了provider，触发重新创建
    if (provider) {
      // 通过状态更新触发useEffect
      setStatus("loading");
    }
  }, [provider]);

  /**
   * 创建实例的核心逻辑
   */
  const createInstance = useCallback(async (signal: AbortSignal) => {
    console.log("🚀 createInstance called", { 
      provider: !!providerRef.current, 
      enabled: enabledRef.current,
      chainId: chainIdRef.current 
    });
    
    if (!providerRef.current) {
      console.log("❌ No provider, setting idle");
      setStatus("idle");
      return;
    }

    // 防止无限重试
    if (retryCount >= 3) {
      setError(new Error("Maximum retry attempts reached. Please refresh the page."));
      setStatus("error");
      return;
    }

    try {
      setStatus("loading");
      setError(undefined);

      // 检查是否可以复用现有实例
      if (instanceManager.isInstanceValid(providerRef.current, chainIdRef.current)) {
        const existingInstance = instanceManager.getCurrentInstance();
        if (existingInstance && !signal.aborted) {
          setInstance(existingInstance);
          setStatus("ready");
          return;
        }
      }

      // 创建新实例
      const newInstance = await createFhevmInstance(
        providerRef.current,
        {
          mockChains: mockChainsRef.current,
          signal,
          onStatusChange: (status) => {
            console.log(`[useFhevm] Status: ${status}`);
          },
        }
      );

      if (signal.aborted) return;

      setInstance(newInstance);
      setStatus("ready");
      
    } catch (err) {
      if (signal.aborted) return;

      const error = err as Error;
      console.error("[useFhevm] Failed to create instance:", error);
      
      setInstance(undefined);
      setError(error);
      setStatus("error");
      setRetryCount(prev => prev + 1);
    }
  }, [retryCount]);

  /**
   * 主要的副作用：管理实例生命周期
   */
  useEffect(() => {
    console.log("📋 FHEVM useEffect triggered", { 
      enabled: enabledRef.current, 
      provider: !!providerRef.current,
      chainId: chainIdRef.current
    });
    
    if (!enabledRef.current) {
      console.log("❌ FHEVM disabled, clearing state");
      // 如果disabled，清理所有状态
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      instanceManager.clearInstance();
      setInstance(undefined);
      setError(undefined);
      setStatus("idle");
      return;
    }

    if (!providerRef.current) {
      console.log("❌ No provider available");
      setInstance(undefined);
      setError(undefined);
      setStatus("idle");
      return;
    }

    console.log("✅ Starting FHEVM instance creation...");
    
    // 创建新的AbortController
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // 创建实例
    createInstance(abortControllerRef.current.signal);

    // 清理函数
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [createInstance, enabled, provider, chainId]); // 添加关键依赖

  /**
   * 组件卸载时的清理
   */
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  return {
    instance,
    refresh,
    error,
    status,
  };
}

/**
 * FHEVM Hook的扩展版本，提供更多功能
 */
export interface UseFhevmExtendedReturn extends UseFhevmReturn {
  isLoading: boolean;
  isReady: boolean;
  isError: boolean;
  chainId?: number;
  isMockMode: boolean;
  retryCount: number;
  retry: () => void;
}

export function useFhevmExtended(params: UseFhevmParams): UseFhevmExtendedReturn {
  const baseResult = useFhevm(params);
  const [retryCount, setRetryCount] = useState(0);

  // 派生状态
  const isLoading = baseResult.status === "loading";
  const isReady = baseResult.status === "ready";
  const isError = baseResult.status === "error";
  const isMockMode = params.initialMockChains && 
                     params.chainId === 31337;

  /**
   * 重试函数
   */
  const retry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    baseResult.refresh();
  }, [baseResult]);

  return {
    ...baseResult,
    isLoading,
    isReady,
    isError,
    chainId: params.chainId,
    isMockMode: Boolean(isMockMode),
    retryCount,
    retry,
  };
}

/**
 * 带自动重试的FHEVM Hook
 */
export function useFhevmWithRetry(
  params: UseFhevmParams,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    retryOn?: (error: Error) => boolean;
  } = {}
): UseFhevmExtendedReturn {
  const { maxRetries = 3, retryDelay = 2000, retryOn } = options;
  const baseResult = useFhevmExtended(params);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const [autoRetryCount, setAutoRetryCount] = useState(0);

  /**
   * 自动重试逻辑
   */
  useEffect(() => {
    if (baseResult.isError && 
        baseResult.error && 
        autoRetryCount < maxRetries) {
      
      // 检查是否应该重试
      const shouldRetry = retryOn ? retryOn(baseResult.error) : 
                         baseResult.error instanceof FhevmSDKError;
      
      if (shouldRetry) {
        console.log(`[useFhevm] Auto retry ${autoRetryCount + 1}/${maxRetries} in ${retryDelay}ms`);
        
        retryTimeoutRef.current = setTimeout(() => {
          setAutoRetryCount(prev => prev + 1);
          baseResult.retry();
        }, retryDelay);
      }
    }

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [baseResult.isError, baseResult.error, autoRetryCount, maxRetries, retryDelay, retryOn, baseResult]);

  /**
   * 成功时重置重试计数
   */
  useEffect(() => {
    if (baseResult.isReady) {
      setAutoRetryCount(0);
    }
  }, [baseResult.isReady]);

  return {
    ...baseResult,
    retryCount: baseResult.retryCount + autoRetryCount,
  };
}

/**
 * 简化的FHEVM Hook，只返回实例和加载状态
 */
export function useFhevmSimple(
  provider: string | ethers.Eip1193Provider | undefined,
  chainId?: number,
  mockChains?: Record<number, string>
): {
  instance: FhevmInstance | undefined;
  isLoading: boolean;
  error?: Error;
} {
  const { instance, status, error } = useFhevm({
    provider,
    chainId,
    initialMockChains: mockChains,
  });

  return {
    instance,
    isLoading: status === "loading",
    error,
  };
}
