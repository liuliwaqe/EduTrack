const { ethers } = require("hardhat");

async function main() {
  console.log("🔧 测试学生积分功能...");

  try {
    // 获取合约实例
    const contractAddress = "0x9A676e781A523b5d0C0e43731313A708CB607508";
    const contract = await ethers.getContractAt("MaskedAttendance", contractAddress);

    // 获取签名者
    const [deployer, teacher, student] = await ethers.getSigners();

    console.log("📋 合约地址:", contractAddress);
    console.log("👨‍🎓 学生地址:", student.address);

    // 检查学生是否注册
    const isStudentRegistered = await contract.isStudent(student.address);
    console.log("📝 学生注册状态:", isStudentRegistered);

    if (!isStudentRegistered) {
      console.log("⚠️ 学生未注册，先注册...");
      await contract.connect(deployer).registerStudent(student.address);
      console.log("✅ 学生注册成功");
    }

    // 检查学生积分
    console.log("🔍 检查学生积分...");
    const encryptedScoreHandle = await contract.getStudentScore(student.address);
    console.log("加密积分句柄:", encryptedScoreHandle);

    // 检查是否为零句柄
    if (encryptedScoreHandle === ethers.ZeroHash) {
      console.log("❌ 积分句柄是零值 - 学生积分未初始化");
    } else {
      console.log("✅ 积分句柄有效 - 学生积分已初始化");
    }

    // 尝试获取课程ID
    const nextCourseId = await contract.nextCourseId();
    console.log("📚 课程总数:", nextCourseId.toString());

    if (nextCourseId > 1) {
      // 尝试进行一次签到来更新积分
      console.log("🚀 尝试进行签到操作...");

      // 创建模拟的FHE数据
      const mockHandle = "0x" + "00".repeat(32);
      const mockProof = "0x" + "00".repeat(64);

      try {
        const tx = await contract.connect(student).checkIn(1, mockHandle, mockProof);
        console.log("✅ checkIn 调用成功!");
        const receipt = await tx.wait();
        console.log("✅ 交易确认:", receipt.hash);

        // 再次检查积分
        console.log("🔍 签到后检查积分...");
        const newScoreHandle = await contract.getStudentScore(student.address);
        console.log("新的积分句柄:", newScoreHandle);

        if (newScoreHandle !== encryptedScoreHandle) {
          console.log("✅ 积分句柄已更新 - 积分应该增加了!");
        } else {
          console.log("⚠️ 积分句柄未变化");
        }

      } catch (error) {
        console.log("❌ checkIn 调用失败:");
        console.log("错误类型:", error.constructor.name);
        console.log("错误消息:", error.message);
      }
    } else {
      console.log("⚠️ 没有可用的课程");
    }

  } catch (error) {
    console.error("❌ 测试脚本执行失败:", error);
  }

  console.log("\n🔧 测试总结:");
  console.log("1. 检查学生积分句柄是否正确初始化");
  console.log("2. 验证签到后积分句柄是否更新");
  console.log("3. 前端检查逻辑是否正确处理积分句柄");
}

main().catch(console.error);

