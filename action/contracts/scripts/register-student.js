const { ethers } = require("hardhat");

async function main() {
  // 获取合约实例（使用最新部署的地址）
  const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const contract = await ethers.getContractAt("MaskedAttendance", contractAddress);
  
  // 获取账户
  const [deployer, teacher, student] = await ethers.getSigners();
  
  console.log("当前学生地址:", student.address);
  
  // 检查学生是否已注册
  const isRegistered = await contract.isStudent(student.address);
  console.log("学生是否已注册:", isRegistered);
  
  if (!isRegistered) {
    console.log("正在注册学生...");
    const tx = await contract.connect(deployer).registerStudent(student.address);
    await tx.wait();
    console.log("✅ 学生注册成功!");
  } else {
    console.log("✅ 学生已经注册");
  }
  
  // 再次验证
  const isNowRegistered = await contract.isStudent(student.address);
  console.log("最终注册状态:", isNowRegistered);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
