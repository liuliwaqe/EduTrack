const { ethers } = require("hardhat");

async function main() {
  try {
    // 获取合约和账户
    const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    const contract = await ethers.getContractAt("MaskedAttendance", contractAddress);
    const [deployer, teacher, student] = await ethers.getSigners();
    
    console.log("学生地址:", student.address);
    console.log("合约地址:", contractAddress);
    
    // 检查学生是否注册
    const isStudentRegistered = await contract.isStudent(student.address);
    console.log("学生注册状态:", isStudentRegistered);
    
    // 检查课程状态
    const courseCount = await contract.nextCourseId();
    console.log("课程总数:", courseCount.toString());
    
    if (courseCount > 1) {
      const course = await contract.courses(1);
      console.log("课程1详情:", {
        name: course.name,
        teacher: course.teacher,
        isActive: course.isActive,
        isFinalized: course.isFinalized,
        startTime: new Date(Number(course.startTime) * 1000).toLocaleString(),
        endTime: new Date(Number(course.endTime) * 1000).toLocaleString()
      });
      
      // 检查当前时间
      const currentTime = Math.floor(Date.now() / 1000);
      console.log("时间检查:", {
        currentTime: new Date(currentTime * 1000).toLocaleString(),
        courseStart: Number(course.startTime),
        courseEnd: Number(course.endTime),
        isInRange: currentTime >= Number(course.startTime) && currentTime <= Number(course.endTime)
      });
      
      // 尝试直接调用checkIn（不使用加密）
      try {
        // 创建模拟的加密输入
        const mockEncrypted = "0x0000000000000000000000000000000000000000000000000000000000000001";
        const mockProof = "0x";
        
        console.log("尝试调用checkIn...");
        const tx = await contract.connect(student).checkIn(1, mockEncrypted, mockProof);
        console.log("✅ checkIn调用成功！");
        
      } catch (error) {
        console.log("❌ checkIn调用失败:");
        console.log("错误类型:", error.constructor.name);
        console.log("错误代码:", error.code);
        console.log("错误数据:", error.data);
        console.log("错误原因:", error.reason);
        
        // 尝试解码错误
        if (error.data) {
          try {
            const iface = new ethers.Interface([
              "error InvalidInput()",
              "error AlreadyCheckedIn()",
              "error NotAuthorized()",
              "error CourseNotActive()",
              "error InvalidTimeRange()"
            ]);
            const decodedError = iface.parseError(error.data);
            console.log("解码的错误:", decodedError);
          } catch (decodeError) {
            console.log("无法解码错误，可能是FHEVM内部错误");
          }
        }
      }
    }
    
  } catch (error) {
    console.error("脚本执行失败:", error);
  }
}

main().catch(console.error);
