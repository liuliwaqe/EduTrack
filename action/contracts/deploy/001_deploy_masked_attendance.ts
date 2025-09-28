import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer, admin } = await getNamedAccounts();

  console.log("Deploying MaskedAttendance with deployer:", deployer);

  const maskedAttendance = await deploy("MaskedAttendance", {
    from: deployer,
    args: [], // 构造函数无参数，admin在构造函数中设为msg.sender
    log: true,
    autoMine: true, // 在本地网络上自动挖矿
  });

  console.log("MaskedAttendance deployed to:", maskedAttendance.address);
  console.log("Transaction hash:", maskedAttendance.transactionHash);

  // 验证合约部署
  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    console.log("Waiting for block confirmations...");
    await new Promise((resolve) => setTimeout(resolve, 30000)); // 等待30秒

    try {
      await hre.run("verify:verify", {
        address: maskedAttendance.address,
        constructorArguments: [],
      });
      console.log("Contract verified on Etherscan");
    } catch (error) {
      console.log("Verification failed:", error);
    }
  }

  // 在本地网络上设置一些初始数据用于测试
  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    const { ethers } = hre;
    const [deployerSigner, teacherSigner, studentSigner] = await ethers.getSigners();
    
    const contract = await ethers.getContractAt("MaskedAttendance", maskedAttendance.address);

    console.log("Setting up test data...");
    
    // 注册教师
    console.log("Registering teacher:", teacherSigner.address);
    await contract.connect(deployerSigner).registerTeacher(teacherSigner.address);
    
    // 注册学生
    console.log("Registering student:", studentSigner.address);
    await contract.connect(deployerSigner).registerStudent(studentSigner.address);
    
    console.log("Test data setup completed!");
  }
};

func.tags = ["MaskedAttendance"];
export default func;
