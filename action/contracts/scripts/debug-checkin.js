/**
 * 调试签到问题的脚本 - 详细错误捕获版本
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("🔧 调试 checkIn 功能 - 详细错误分析...\n");

  try {
    // 获取合约实例
    const contractAddress = "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e";
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

    // 检查课程是否存在
    const nextCourseId = await contract.nextCourseId();
    console.log("📚 课程总数:", nextCourseId.toString());

    if (nextCourseId > 1) {
      const courseInfo = await contract.getCourseInfo(1);
      console.log("📖 课程1信息:", {
        name: courseInfo[0],
        teacher: courseInfo[1],
        startTime: new Date(Number(courseInfo[2]) * 1000).toLocaleString(),
        endTime: new Date(Number(courseInfo[3]) * 1000).toLocaleString(),
        isFinalized: courseInfo[4]
      });

      // 创建模拟的FHE数据
      const mockHandle = "0x" + "00".repeat(32); // 32字节的0
      const mockProof = "0x" + "00".repeat(64); // 64字节的证明

      console.log("🔐 测试数据:");
      console.log("  课程ID:", 1);
      console.log("  加密句柄:", mockHandle);
      console.log("  证明长度:", mockProof.length);

      // 测试checkIn调用
      console.log("🚀 尝试调用 checkIn...");
      try {
        const tx = await contract.connect(student).checkIn(1, mockHandle, mockProof);
        console.log("✅ checkIn 调用成功!");
        const receipt = await tx.wait();
        console.log("✅ 交易确认:", receipt.hash);
      } catch (error) {
        console.log("❌ checkIn 调用失败:");

        // 尝试解析错误
        if (error.data) {
          console.log("📋 原始错误数据:", error.data);

          // 尝试解析为自定义错误
          try {
            const iface = new ethers.Interface([
              "error AlreadyCheckedIn()",
              "error NotInTimeWindow()",
              "error InvalidSignature()",
              "error InvalidProof()",
              "error CourseNotActive()",
              "function checkIn(uint256,bytes,bytes)"
            ]);

            const decodedError = iface.parseError(error.data);
            console.log("🔍 解码的错误:", {
              name: decodedError.name,
              args: decodedError.args
            });
          } catch (decodeError) {
            console.log("⚠️ 无法使用标准接口解码错误");

            // 尝试手动解析
            const errorData = error.data.slice(2);
            console.log("📋 错误数据(十六进制):", errorData);

            // 检查是否是自定义错误
            if (errorData.startsWith('9de3392c')) {
              console.log("🚨 检测到自定义错误: 0x9de3392c");
              console.log("📋 这通常表示合约内部逻辑错误");
            }

            // 检查其他可能的错误签名
            if (errorData.startsWith('08c379a')) {
              console.log("🚨 检测到 require() 错误");
              // 提取错误消息
              const messageData = errorData.slice(8);
              try {
                const message = ethers.utils.defaultAbiCoder.decode(['string'], '0x' + messageData)[0];
                console.log("📋 错误消息:", message);
              } catch (e) {
                console.log("📋 无法解码错误消息");
              }
            }
          }
        }

        console.log("📋 错误类型:", error.constructor.name);
        console.log("📋 错误代码:", error.code);
        console.log("📋 错误原因:", error.reason);
        console.log("📋 错误消息:", error.message);

        // 检查是否是 gas 估算失败
        if (error.code === 'CALL_EXCEPTION' && error.action === 'estimateGas') {
          console.log("💡 这是一个 gas 估算失败，说明合约执行会 revert");
          console.log("💡 通常是由于合约条件不满足导致的");
        }
      }
    } else {
      console.log("⚠️ 没有可用的课程，请先创建课程");
    }

  } catch (error) {
    console.error("❌ 调试脚本执行失败:", error);
  }

  console.log("\n🔧 调试建议:");
  console.log("1. 如果是 InvalidSignature -> 检查签名生成逻辑");
  console.log("2. 如果是 InvalidProof -> 检查 FHE 证明生成");
  console.log("3. 如果是 AlreadyCheckedIn -> 检查重复签到逻辑");
  console.log("4. 如果是 NotInTimeWindow -> 检查时间验证");
  console.log("5. 如果是其他错误 -> 检查合约逻辑和参数传递");
}

main().catch(console.error);
