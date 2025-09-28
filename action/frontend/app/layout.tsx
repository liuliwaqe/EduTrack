import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "MaskedAttendance - 隐私保护出勤系统",
  description: "基于FHEVM的学生出勤数据加密管理系统，保护隐私，确保数据安全。",
  keywords: ["FHEVM", "区块链", "隐私保护", "出勤管理", "加密", "教育"],
  authors: [{ name: "MaskedAttendance Team" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "MaskedAttendance - 隐私保护出勤系统",
    description: "基于FHEVM的学生出勤数据加密管理系统",
    type: "website",
    locale: "zh_CN",
  },
};

export const viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={inter.variable}>
      <head>
        {/* PWA支持 */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        
        {/* 安全头 */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <Providers>
          <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
            {/* 背景装饰 */}
            <div className="fixed inset-0 education-pattern opacity-5 pointer-events-none" />
            
            {/* 主要内容 */}
            <main className="relative z-10">
              {children}
            </main>
            
            {/* 全局通知容器 */}
            <div id="notification-root" className="fixed top-4 right-4 z-50" />
          </div>
        </Providers>
      </body>
    </html>
  );
}
