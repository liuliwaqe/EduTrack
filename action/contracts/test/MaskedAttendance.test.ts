import { expect } from "chai";
import { ethers } from "hardhat";
import { MaskedAttendance } from "../types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("MaskedAttendance", function () {
  let maskedAttendance: MaskedAttendance;
  let admin: HardhatEthersSigner;
  let teacher: HardhatEthersSigner;
  let student1: HardhatEthersSigner;
  let student2: HardhatEthersSigner;

  beforeEach(async function () {
    [admin, teacher, student1, student2] = await ethers.getSigners();

    const MaskedAttendanceFactory = await ethers.getContractFactory("MaskedAttendance");
    maskedAttendance = await MaskedAttendanceFactory.deploy();
    await maskedAttendance.waitForDeployment();
  });

  describe("用户注册", function () {
    it("管理员可以注册教师", async function () {
      await maskedAttendance.connect(admin).registerTeacher(teacher.address);
      expect(await maskedAttendance.isTeacher(teacher.address)).to.be.true;
    });

    it("管理员可以注册学生", async function () {
      await maskedAttendance.connect(admin).registerStudent(student1.address);
      expect(await maskedAttendance.isStudent(student1.address)).to.be.true;
    });

    it("学生可以自助注册", async function () {
      await maskedAttendance.connect(student1).selfRegister();
      expect(await maskedAttendance.isStudent(student1.address)).to.be.true;
    });

    it("非管理员不能注册教师", async function () {
      await expect(
        maskedAttendance.connect(teacher).registerTeacher(student1.address)
      ).to.be.revertedWith("Only admin");
    });
  });

  describe("课程管理", function () {
    beforeEach(async function () {
      // 注册教师
      await maskedAttendance.connect(admin).registerTeacher(teacher.address);
    });

    it("教师可以创建课程", async function () {
      const startTime = Math.floor(Date.now() / 1000) + 3600; // 1小时后
      const endTime = startTime + 3600; // 2小时后

      await expect(
        maskedAttendance.connect(teacher).createCourse(
          "数学课",
          startTime,
          endTime
        )
      ).to.emit(maskedAttendance, "CourseCreated")
       .withArgs(0, "数学课", teacher.address);

      const courseInfo = await maskedAttendance.getCourseInfo(0);
      expect(courseInfo.name).to.equal("数学课");
      expect(courseInfo.teacher).to.equal(teacher.address);
    });

    it("非教师不能创建课程", async function () {
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime + 3600;

      await expect(
        maskedAttendance.connect(student1).createCourse(
          "数学课",
          startTime,
          endTime
        )
      ).to.be.revertedWith("Only teacher");
    });

    it("开始时间必须是未来时间", async function () {
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1小时前
      const endTime = pastTime + 3600;

      await expect(
        maskedAttendance.connect(teacher).createCourse(
          "数学课",
          pastTime,
          endTime
        )
      ).to.be.revertedWith("Start time must be future");
    });
  });

  describe("学生签到", function () {
    let courseId: number;
    const startTime = Math.floor(Date.now() / 1000) + 60; // 1分钟后
    const endTime = startTime + 3600; // 1小时后

    beforeEach(async function () {
      // 注册教师和学生
      await maskedAttendance.connect(admin).registerTeacher(teacher.address);
      await maskedAttendance.connect(admin).registerStudent(student1.address);

      // 创建课程
      await maskedAttendance.connect(teacher).createCourse(
        "数学课",
        startTime,
        endTime
      );
      courseId = 0;

      // 等待课程开始
      await ethers.provider.send("evm_increaseTime", [120]); // 增加2分钟
      await ethers.provider.send("evm_mine", []);
    });

    it("学生可以签到", async function () {
      // 注意：在真实环境中，这里需要使用FHEVM SDK生成加密输入
      // 这里我们模拟一个简化的测试场景
      const encryptedStatus = "0x" + "00".repeat(32); // 模拟加密数据
      const proof = "0x" + "00".repeat(64); // 模拟证明

      await expect(
        maskedAttendance.connect(student1).checkIn(
          courseId,
          encryptedStatus,
          proof
        )
      ).to.emit(maskedAttendance, "StudentCheckedIn")
       .withArgs(courseId, student1.address);
    });

    it("非学生不能签到", async function () {
      const encryptedStatus = "0x" + "00".repeat(32);
      const proof = "0x" + "00".repeat(64);

      await expect(
        maskedAttendance.connect(teacher).checkIn(
          courseId,
          encryptedStatus,
          proof
        )
      ).to.be.revertedWith("Only student");
    });
  });

  describe("课程统计", function () {
    let courseId: number;
    const startTime = Math.floor(Date.now() / 1000) + 60;
    const endTime = startTime + 3600;

    beforeEach(async function () {
      // 设置测试环境
      await maskedAttendance.connect(admin).registerTeacher(teacher.address);
      await maskedAttendance.connect(admin).registerStudent(student1.address);
      
      await maskedAttendance.connect(teacher).createCourse(
        "数学课",
        startTime,
        endTime
      );
      courseId = 0;
    });

    it("教师可以结束课程", async function () {
      // 等待课程结束
      await ethers.provider.send("evm_increaseTime", [3700]); // 增加时间超过课程结束时间
      await ethers.provider.send("evm_mine", []);

      await expect(
        maskedAttendance.connect(teacher).finalizeCourse(courseId)
      ).to.emit(maskedAttendance, "CourseFinalized")
       .withArgs(courseId);

      const courseInfo = await maskedAttendance.getCourseInfo(courseId);
      expect(courseInfo.isFinalized).to.be.true;
    });

    it("非课程教师不能结束课程", async function () {
      // 注册另一个教师
      await maskedAttendance.connect(admin).registerTeacher(student2.address);
      
      // 等待课程结束
      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        maskedAttendance.connect(student2).finalizeCourse(courseId)
      ).to.be.revertedWith("Only course teacher");
    });
  });

  describe("权限控制", function () {
    it("只有管理员可以更改管理员", async function () {
      await expect(
        maskedAttendance.connect(teacher).updateAdmin(teacher.address)
      ).to.be.revertedWith("Only admin");
    });

    it("管理员可以更改管理员", async function () {
      await maskedAttendance.connect(admin).updateAdmin(teacher.address);
      expect(await maskedAttendance.admin()).to.equal(teacher.address);
    });
  });

  describe("FHEVM功能测试", function () {
    beforeEach(async function () {
      await maskedAttendance.connect(admin).registerTeacher(teacher.address);
      await maskedAttendance.connect(admin).registerStudent(student1.address);
      await maskedAttendance.connect(admin).registerStudent(student2.address);
    });

    it("教师可以生成随机奖励", async function () {
      await expect(
        maskedAttendance.connect(teacher).generateRandomBonus(student1.address)
      ).to.not.be.reverted;

      // 验证学生总分被更新（虽然是加密的）
      const encryptedScore = await maskedAttendance.getStudentTotalScore(student1.address);
      expect(encryptedScore).to.not.be.undefined;
    });

    it("管理员可以比较学生分数", async function () {
      // 先给学生一些分数
      await maskedAttendance.connect(teacher).generateRandomBonus(student1.address);
      await maskedAttendance.connect(teacher).generateRandomBonus(student2.address);

      // 比较分数（返回加密的布尔值）
      const comparison = await maskedAttendance.connect(admin).compareStudentScores(
        student1.address,
        student2.address
      );
      
      expect(comparison).to.not.be.undefined;
    });

    it("可以计算学生等级", async function () {
      const grade = await maskedAttendance.calculateGrade(student1.address);
      expect(grade).to.not.be.undefined;
    });
  });
});
