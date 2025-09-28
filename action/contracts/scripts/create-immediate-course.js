const { ethers } = require("hardhat");

async function main() {
  console.log("🔧 创建立即可用的测试课程...");

  try {
    // 获取合约实例
    const contractAddress = "0x9A676e781A523b5d0C0e43731313A708CB607508";
    const contract = await ethers.getContractAt("MaskedAttendance", contractAddress);

    // 获取签名者
    const [deployer, teacher, student] = await ethers.getSigners();

    console.log("📋 合约地址:", contractAddress);
    console.log("👨‍🏫 教师地址:", teacher.address);
    console.log("👨‍🎓 学生地址:", student.address);

    // 检查教师是否已注册
    const isTeacherRegistered = await contract.isTeacher(teacher.address);
    console.log("📝 教师注册状态:", isTeacherRegistered);

    if (!isTeacherRegistered) {
      console.log("⚠️ 教师未注册，先注册教师...");
      await contract.connect(deployer).registerTeacher(teacher.address);
      console.log("✅ 教师注册成功");
    }

    // 创建立即可用的测试课程
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = currentTime - 60; // 1分钟前开始（立即可用）
    const endTime = currentTime + 1800; // 30分钟后结束

    console.log("📚 创建立即可用的测试课程...");
    console.log("  课程名称: 立即测试课程 - FHEVM签到系统");
    console.log("  开始时间:", new Date(startTime * 1000).toLocaleString());
    console.log("  结束时间:", new Date(endTime * 1000).toLocaleString());
    console.log("  当前时间:", new Date(currentTime * 1000).toLocaleString());

    const createCourseTx = await contract.connect(teacher).createCourse(
      "立即测试课程 - FHEVM签到系统",
      startTime,
      endTime
    );

    console.log("⏳ 等待交易确认...");
    const receipt = await createCourseTx.wait();
    console.log("✅ 课程创建成功，交易哈希:", receipt.hash);

    // 从事件中获取课程ID
    const event = receipt.logs.find(log => log.topics[0] === ethers.id("CourseCreated(uint256,string,address)"));
    const courseId = parseInt(event.topics[1], 16);

    console.log("🎯 新创建的课程ID:", courseId);

    // 获取课程信息
    const courseInfo = await contract.getCourseInfo(courseId);
    console.log("📖 课程信息:", {
      name: courseInfo[0],
      teacher: courseInfo[1],
      startTime: new Date(Number(courseInfo[2]) * 1000).toLocaleString(),
      endTime: new Date(Number(courseInfo[3]) * 1000).toLocaleString(),
      isFinalized: courseInfo[4]
    });

    // 获取调试信息
    const debugInfo = await contract.getCourseDebugInfo(courseId);
    console.log("🔍 课程调试信息:", {
      name: debugInfo[0],
      teacher: debugInfo[1],
      startTime: new Date(Number(debugInfo[2]) * 1000).toLocaleString(),
      endTime: new Date(Number(debugInfo[3]) * 1000).toLocaleString(),
      isActive: debugInfo[4],
      isFinalized: debugInfo[5],
      currentTime: new Date(Number(debugInfo[6]) * 1000).toLocaleString(),
      canCheckIn: debugInfo[7]
    });

    console.log("\n🎉 立即可用测试课程创建完成！");
    console.log("📋 现在可以立即在前端测试签到功能了");
    console.log("🔗 课程ID:", courseId);
    console.log("👤 学生地址:", student.address);
    console.log("⏰ 课程状态: 立即可用（已开始）");

  } catch (error) {
    console.error("❌ 创建课程失败:", error);
    console.error("错误详情:", error.message);
  }
}

main().catch(console.error);
