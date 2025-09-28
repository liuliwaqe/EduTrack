# MaskedAttendance 快速开始指南

## 🎯 项目概述

MaskedAttendance 是一个基于 FHEVM（全同态加密虚拟机）的隐私保护学生出勤管理系统，实现了：

- 🔐 **端到端加密**：学生出勤数据完全加密存储
- 📊 **同态统计**：无需解密即可进行出勤率计算  
- 🎯 **精确权限控制**：基于ACL的访问权限管理
- 🚀 **本地开发支持**：完整的Mock环境

## 🏗️ 项目架构

```
action/
├── contracts/          # FHEVM智能合约
│   ├── src/           # 合约源码
│   ├── deploy/        # 部署脚本
│   ├── test/          # 合约测试
│   └── package.json   # 合约依赖
└── frontend/          # React前端应用
    ├── app/          # Next.js 15页面
    ├── components/   # UI组件
    ├── hooks/        # 自定义Hooks
    ├── fhevm/        # FHEVM集成模块
    └── package.json  # 前端依赖
```

## 🚀 快速启动

### 1. 环境准备

确保你的系统已安装：
- Node.js >= 18.0.0
- npm >= 7.0.0
- MetaMask浏览器扩展

### 2. 启动合约开发环境

```bash
# 进入合约目录
cd contracts

# 安装依赖
npm install

# 启动本地FHEVM节点
npm run node
```

### 3. 部署智能合约

```bash
# 在新终端中部署合约
npm run deploy:local

# 查看部署信息
ls deployments/localhost/
```

### 4. 启动前端应用

```bash
# 进入前端目录
cd ../frontend

# 安装依赖
npm install

# 生成ABI文件
npm run genabi

# 启动开发服务器
npm run dev:mock
```

### 5. 配置MetaMask

1. 打开MetaMask，添加本地网络：
   - 网络名称：`Localhost`
   - RPC URL：`http://127.0.0.1:8545`
   - 链ID：`31337`
   - 货币符号：`ETH`

2. 导入测试账户私钥（从Hardhat输出中获取）

### 6. 访问应用

打开浏览器访问：http://localhost:3000

## 🔧 核心功能展示

### FHEVM特性

我们的合约充分展示了FHEVM的强大功能：

```solidity
// 🔐 同态加密数据类型
euint8 status;              // 加密的出勤状态
euint32 totalAttendance;    // 加密的总出勤数
eaddress studentAddress;    // 加密的学生地址

// 🔐 同态运算操作
euint32 result = FHE.add(totalAttendance, FHE.asEuint32(1));
ebool isAttending = FHE.eq(status, FHE.asEuint8(1));
euint32 rate = FHE.div(FHE.mul(attended, 100), total);

// 🔐 条件选择
euint32 newValue = FHE.select(condition, valueIfTrue, valueIfFalse);

// 🔐 随机数生成
euint8 randomBonus = FHE.randEuint8();

// 🔑 访问控制
FHE.allowThis(encryptedData);
FHE.allow(encryptedData, authorizedUser);
```

### 前端FHEVM集成

```typescript
// 🔐 创建加密输入
const input = fhevmInstance.createEncryptedInput(contractAddress, userAddress);
input.add8(BigInt(1));  // 出勤状态
input.addAddress(userAddress);  // 学生地址

// 🔐 执行加密
const encrypted = await input.encrypt();

// 🔐 调用合约
await contract.checkIn(courseId, encrypted.handles[0], encrypted.inputProof);

// 🔐 用户解密
const decrypted = await fhevmInstance.userDecrypt([{
  handle: encryptedHandle,
  contractAddress
}], privateKey, publicKey, signature, ...);
```

## 📱 用户角色

### 学生端功能
- ✅ 隐私签到（出勤/缺席）
- ✅ 查看个人出勤记录
- ✅ 出勤率统计
- ✅ 积分查看

### 教师端功能（开发中）
- 🔄 创建课程
- 🔄 设置签到时间窗口
- 🔄 查看课程出勤统计
- 🔄 生成出勤报告

### 管理员功能（开发中）
- 🔄 用户权限管理
- 🔄 系统配置
- 🔄 数据统计

## 🛠️ 开发命令

### 合约开发
```bash
cd contracts

# 编译合约
npm run compile

# 运行测试
npm run test

# 部署到Sepolia
npm run deploy:sepolia

# 清理编译文件
npm run clean
```

### 前端开发
```bash
cd frontend

# 开发模式（带Mock）
npm run dev:mock

# 生产构建
npm run build

# 启动生产服务
npm run start

# 代码检查
npm run lint
```

## 🔍 故障排除

### 常见问题

**1. FHEVM SDK加载失败**
```
解决方案：检查网络连接，确保能访问CDN
```

**2. 合约调用失败**
```
解决方案：确保MetaMask连接到正确网络，账户有足够ETH
```

**3. 加密操作超时**
```
解决方案：FHEVM加密是CPU密集型操作，请耐心等待
```

**4. 解密权限不足**
```
解决方案：确保已正确设置ACL权限，签名未过期
```

### 调试技巧

1. **开启详细日志**
   ```typescript
   // 在浏览器控制台查看FHEVM日志
   localStorage.setItem('debug', 'fhevm:*');
   ```

2. **检查合约部署**
   ```bash
   # 查看部署信息
   cat deployments/localhost/MaskedAttendance.json
   ```

3. **验证FHEVM节点**
   ```bash
   # 检查本地节点状态
   curl -X POST http://localhost:8545 \
     -H "Content-Type: application/json" \
     -d '{"method":"web3_clientVersion","params":[],"id":1,"jsonrpc":"2.0"}'
   ```

## 📚 技术文档

- [FHEVM开发参考](./出勤模板/FHEVM_Development_Reference.md)
- [前端集成指南](./出勤模板/FHEVM_Frontend_Integration_Guide.md)
- [Relayer SDK参考](./出勤模板/FHEVM_RelayerSDK_DApp_Reference.md)

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- [Zama](https://zama.ai/) - FHEVM技术支持
- [Hardhat](https://hardhat.org/) - 开发框架
- [Next.js](https://nextjs.org/) - React框架
- [Tailwind CSS](https://tailwindcss.com/) - 样式框架

---

🎉 **恭喜！你现在拥有了一个完整的FHEVM隐私保护出勤系统！**

如有问题，请查看文档或提交Issue。
