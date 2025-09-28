"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { GenericStringStorage } from "@/fhevm/types";
import { InMemoryStorage } from "@/fhevm/storage";

/**
 * 应用程序上下文接口
 */
interface AppContextType {
  // 存储管理
  storage: GenericStringStorage;
  
  // 全局状态
  isInitialized: boolean;
  setIsInitialized: (initialized: boolean) => void;
  
  // 错误处理
  globalError: string | null;
  setGlobalError: (error: string | null) => void;
  
  // 通知系统
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
}

/**
 * 通知接口
 */
interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  timestamp: number;
  duration?: number; // 自动消失时间（毫秒）
}

/**
 * 应用程序上下文
 */
const AppContext = createContext<AppContextType | undefined>(undefined);

/**
 * 存储Provider
 */
interface StorageProviderProps {
  children: ReactNode;
}

export function StorageProvider({ children }: StorageProviderProps) {
  const [storage] = useState<GenericStringStorage>(() => new InMemoryStorage());
  
  return (
    <StorageContext.Provider value={{ storage }}>
      {children}
    </StorageContext.Provider>
  );
}

const StorageContext = createContext<{ storage: GenericStringStorage } | undefined>(undefined);

export function useStorage() {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error("useStorage must be used within a StorageProvider");
  }
  return context;
}

/**
 * 通知Provider
 */
interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const timestamp = Date.now();
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp,
      duration: notification.duration || 5000, // 默认5秒
    };

    setNotifications(prev => [...prev, newNotification]);

    // 自动移除通知
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }
  }, [removeNotification]);

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      addNotification, 
      removeNotification 
    }}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
}

const NotificationContext = createContext<{
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
} | undefined>(undefined);

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
}

/**
 * 通知容器组件
 */
function NotificationContainer() {
  const { notifications, removeNotification } = useNotification();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map(notification => (
        <NotificationItem 
          key={notification.id} 
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}

/**
 * 通知项组件
 */
interface NotificationItemProps {
  notification: Notification;
  onClose: () => void;
}

function NotificationItem({ notification, onClose }: NotificationItemProps) {
  const getNotificationStyles = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'bg-success-50 border-success-200 text-success-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-warning-50 border-warning-200 text-warning-800';
      case 'info':
      default:
        return 'bg-primary-50 border-primary-200 text-primary-800';
    }
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className={`
      min-w-80 max-w-md p-4 rounded-lg border shadow-lg
      ${getNotificationStyles(notification.type)}
      animate-slide-up
      transition-all duration-300 ease-in-out
    `}>
      <div className="flex items-start">
        <div className="flex-shrink-0 text-lg mr-3">
          {getIcon(notification.type)}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm">
            {notification.title}
          </h4>
          {notification.message && (
            <p className="mt-1 text-sm opacity-90">
              {notification.message}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 ml-3 text-lg opacity-60 hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/**
 * 全局状态Provider
 */
interface GlobalStateProviderProps {
  children: ReactNode;
}

export function GlobalStateProvider({ children }: GlobalStateProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  return (
    <GlobalStateContext.Provider value={{
      isInitialized,
      setIsInitialized,
      globalError,
      setGlobalError,
    }}>
      {children}
    </GlobalStateContext.Provider>
  );
}

const GlobalStateContext = createContext<{
  isInitialized: boolean;
  setIsInitialized: (initialized: boolean) => void;
  globalError: string | null;
  setGlobalError: (error: string | null) => void;
} | undefined>(undefined);

export function useGlobalState() {
  const context = useContext(GlobalStateContext);
  if (!context) {
    throw new Error("useGlobalState must be used within a GlobalStateProvider");
  }
  return context;
}

/**
 * 主要的Providers组合
 */
interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <GlobalStateProvider>
      <StorageProvider>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </StorageProvider>
    </GlobalStateProvider>
  );
}

/**
 * 应用程序Hook
 */
export function useApp() {
  const globalState = useGlobalState();
  const storage = useStorage();
  const notification = useNotification();

  return {
    ...globalState,
    ...storage,
    ...notification,
  };
}
