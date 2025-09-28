# MaskedAttendance - 学生出勤数据加密系统

基于 FHEVM（Fully Homomorphic Encryption Virtual Machine）的链上出勤系统，实现隐私保护的学生出勤管理。

## 项目结构

```
action/
├── contracts/          # FHEVM 智能合约
│   ├── src/           # 合约源码
│   ├── deploy/        # 部署脚本
│   ├── test/          # 合约测试
│   └── package.json   # 合约项目依赖
├── frontend/          # React 前端应用
│   ├── app/          # Next.js 页面
│   ├── components/   # React 组件
│   ├── hooks/        # 自定义 Hooks
│   ├── fhevm/        # FHEVM 集成
│   └── package.json  # 前端项目依赖
└── README.md         # 项目说明
```

## 快速开始

### 1. 启动本地 FHEVM 节点

```bash
cd contracts
npm install
npm run node
```

### 2. 部署合约

```bash
npm run deploy:local
```

### 3. 启动前端

```bash
cd ../frontend
npm install
npm run dev
```

## 功能特性

- 🔐 **隐私保护**: 学生出勤数据端到端加密
- 📊 **同态统计**: 支持加密数据直接统计
- 🎯 **权限控制**: 基于 ACL 的精确访问控制
- 🚀 **本地开发**: 支持本地 FHEVM Mock 环境
- 📱 **现代UI**: 基于 Next.js 15 + React 19

## 技术栈

- **合约**: Solidity 0.8.24 + FHEVM
- **前端**: Next.js 15 + React 19 + TypeScript
- **加密**: @zama-fhe/relayer-sdk + @fhevm/mock-utils
- **样式**: Tailwind CSS + Ant Design
- **开发**: Hardhat + Turbopack

## 用户角色

- **学生**: 隐私签到，查看个人状态
- **教师**: 创建课程，统计出勤率
- **管理员**: 系统维护，用户管理
