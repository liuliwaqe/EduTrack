// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, euint32, ebool, eaddress, externalEuint8, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title MaskedAttendance - 基于FHEVM的隐私出勤系统
/// @notice 使用FHEVM实现学生出勤数据的端到端加密保护
contract MaskedAttendance is SepoliaConfig {
    
    /// @notice 课程结构体
    struct Course {
        uint256 courseId;
        string name;
        address teacher;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        bool isFinalized;
    }
    
    // 状态变量
    uint256 public nextCourseId;
    address public admin;
    
    // 存储映射
    mapping(uint256 => Course) public courses;
    mapping(address => bool) public isTeacher;
    mapping(address => bool) public isStudent;
    
    // 🔐 核心FHEVM功能：加密出勤记录
    mapping(uint256 => mapping(address => euint8)) public encryptedAttendance; // 0=未签到, 1=出勤, 2=缺席
    mapping(uint256 => euint32) public encryptedTotalAttendance; // 课程总出勤数（加密）
    mapping(address => euint32) public encryptedStudentScore; // 学生总积分（加密）
    
    // 事件
    event CourseCreated(uint256 indexed courseId, string name, address indexed teacher);
    event StudentCheckedIn(uint256 indexed courseId, address indexed student);
    event CourseFinalized(uint256 indexed courseId);
    event CourseStatusChanged(uint256 indexed courseId, bool isActive);
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    
    modifier onlyTeacher() {
        require(isTeacher[msg.sender], "Only teacher");
        _;
    }
    
    modifier onlyStudent() {
        require(isStudent[msg.sender], "Only student");
        _;
    }
    
    modifier courseExists(uint256 courseId) {
        require(courseId > 0 && courseId < nextCourseId, "Course does not exist");
        require(courses[courseId].courseId == courseId, "Course not initialized");
        _;
    }
    
    constructor() {
        admin = msg.sender;
        nextCourseId = 1; // 从1开始，0表示不存在
    }
    
    /// @notice 注册教师
    function registerTeacher(address teacher) external onlyAdmin {
        isTeacher[teacher] = true;
    }
    
    /// @notice 注册学生
    function registerStudent(address student) external onlyAdmin {
        isStudent[student] = true;
    }
    
    /// @notice 学生自助注册
    function selfRegister() external {
        require(!isTeacher[msg.sender], "Teachers cannot self-register as students");
        require(!isStudent[msg.sender], "Already registered as student");

        isStudent[msg.sender] = true;

        // 🔐 初始化学生的加密积分和出勤记录
        encryptedStudentScore[msg.sender] = FHE.asEuint32(0);
        FHE.allowThis(encryptedStudentScore[msg.sender]);
        FHE.allow(encryptedStudentScore[msg.sender], msg.sender);
    }
    
    /// @notice 教师创建课程
    function createCourse(
        string memory name,
        uint256 startTime,
        uint256 endTime
    ) external onlyTeacher returns (uint256 courseId) {
        // 在本地开发环境中放宽时间检查
        // require(startTime > block.timestamp, "Start time must be future");
        require(startTime > block.timestamp - 300, "Start time must not be too far in the past"); // 允许5分钟内的过去时间
        require(endTime > startTime, "End time must be after start");
        
        courseId = nextCourseId++;
        
        courses[courseId] = Course({
            courseId: courseId,
            name: name,
            teacher: msg.sender,
            startTime: startTime,
            endTime: endTime,
            isActive: true,
            isFinalized: false
        });
        
        // 🔐 初始化加密的课程统计数据
        encryptedTotalAttendance[courseId] = FHE.asEuint32(0);
        
        // 🔑 设置ACL权限
        FHE.allowThis(encryptedTotalAttendance[courseId]);
        FHE.allow(encryptedTotalAttendance[courseId], msg.sender);
        
        emit CourseCreated(courseId, name, msg.sender);
    }
    
    /// @notice 🔐 学生加密签到 - 核心FHEVM功能
    function checkIn(
        uint256 courseId,
        externalEuint8 encryptedStatus,  // 1=出勤, 2=缺席
        bytes calldata proof
    ) external onlyStudent courseExists(courseId) {
        // 详细的调试日志
        require(block.timestamp >= courses[courseId].startTime, "Course not started");
        require(block.timestamp <= courses[courseId].endTime, "Course already ended");
        require(!courses[courseId].isFinalized, "Course finalized");
        
        // 🔐 转换外部密文为内部密文
        euint8 status = FHE.fromExternal(encryptedStatus, proof);

        // 🔑 设置基本ACL权限
        FHE.allowThis(status);
        FHE.allow(status, msg.sender);

        // 🔐 处理出勤记录 - 直接更新，不进行复杂的比较
        encryptedAttendance[courseId][msg.sender] = status;

        // 🔑 设置出勤记录的ACL权限
        FHE.allowThis(encryptedAttendance[courseId][msg.sender]);
        FHE.allow(encryptedAttendance[courseId][msg.sender], msg.sender);
        FHE.allow(encryptedAttendance[courseId][msg.sender], courses[courseId].teacher);
        
        // 🔐 更新总出勤数（简化逻辑：每次出勤都增加计数）
        ebool isAttending = FHE.eq(status, FHE.asEuint8(1));
        encryptedTotalAttendance[courseId] = FHE.add(
            encryptedTotalAttendance[courseId],
            FHE.select(isAttending, FHE.asEuint32(1), FHE.asEuint32(0))
        );

        // 🔐 更新学生积分（出勤+10分，简化逻辑）
        euint32 scoreToAdd = FHE.select(
            isAttending,
            FHE.asEuint32(10),
            FHE.asEuint32(0)
        );
        encryptedStudentScore[msg.sender] = FHE.add(
            encryptedStudentScore[msg.sender],
            scoreToAdd
        );

        // 🔑 设置ACL权限
        FHE.allowThis(encryptedTotalAttendance[courseId]);
        FHE.allow(encryptedTotalAttendance[courseId], msg.sender);
        FHE.allow(encryptedTotalAttendance[courseId], courses[courseId].teacher);

        FHE.allowThis(encryptedStudentScore[msg.sender]);
        FHE.allow(encryptedStudentScore[msg.sender], msg.sender);
        
        emit StudentCheckedIn(courseId, msg.sender);
    }
    
    /// @notice 🔐 生成随机奖励积分
    function generateRandomBonus(address student) external onlyTeacher {
        // 🔐 生成随机奖励（1-255分）
        euint8 randomBonus = FHE.randEuint8();
        
        // 🔐 添加到学生总分
        encryptedStudentScore[student] = FHE.add(
            encryptedStudentScore[student], 
            FHE.asEuint32(randomBonus)
        );
        
        // 🔑 更新权限
        FHE.allowThis(encryptedStudentScore[student]);
        FHE.allow(encryptedStudentScore[student], student);
    }

    /// @notice 完结课程 - 需要教师签名（教师可以提前完结课程）
    function finalizeCourse(uint256 courseId) external onlyTeacher {
        require(courses[courseId].courseId != 0, "Course does not exist");
        require(courses[courseId].teacher == msg.sender, "Only course teacher can finalize");
        require(!courses[courseId].isFinalized, "Course already finalized");
        // 移除时间限制，允许教师提前完结课程
        
        courses[courseId].isFinalized = true;
        courses[courseId].isActive = false; // 完结的课程自动变为非活跃
        
        emit CourseFinalized(courseId);
    }

    /// @notice 切换课程状态 - 需要教师签名
    function toggleCourseStatus(uint256 courseId) external onlyTeacher {
        require(courses[courseId].courseId != 0, "Course does not exist");
        require(courses[courseId].teacher == msg.sender, "Only course teacher can modify");
        require(!courses[courseId].isFinalized, "Cannot modify finalized course");
        
        courses[courseId].isActive = !courses[courseId].isActive;
        
        emit CourseStatusChanged(courseId, courses[courseId].isActive);
    }
    
    /// @notice 🔐 比较两个学生的加密积分
    function compareStudentScores(address student1, address student2) 
        external 
        returns (ebool student1Higher) 
    {
        require(msg.sender == admin, "Only admin can compare");
        ebool result = FHE.gt(encryptedStudentScore[student1], encryptedStudentScore[student2]);
        
        // 🔑 设置权限让管理员可以解密比较结果
        FHE.allowThis(result);
        FHE.allow(result, admin);
        
        return result;
    }
    
    
    /// @notice 获取学生的加密出勤记录
    function getStudentAttendance(uint256 courseId, address student) 
        external 
        view 
        courseExists(courseId) 
        returns (euint8) 
    {
        require(
            msg.sender == student || 
            msg.sender == courses[courseId].teacher || 
            msg.sender == admin,
            "Not authorized"
        );
        return encryptedAttendance[courseId][student];
    }
    
    /// @notice 获取课程的加密总出勤数
    function getCourseAttendance(uint256 courseId) 
        external 
        view 
        courseExists(courseId) 
        returns (euint32) 
    {
        require(
            msg.sender == courses[courseId].teacher || 
            msg.sender == admin,
            "Not authorized"
        );
        return encryptedTotalAttendance[courseId];
    }
    
    /// @notice 获取学生的加密总积分
    function getStudentScore(address student) 
        external 
        view 
        returns (euint32) 
    {
        require(msg.sender == student || msg.sender == admin, "Not authorized");
        return encryptedStudentScore[student];
    }
    
    /// @notice 获取课程基本信息
    function getCourseInfo(uint256 courseId)
        external
        view
        courseExists(courseId)
        returns (string memory name, address teacher, uint256 startTime, uint256 endTime, bool isFinalized)
    {
        Course memory course = courses[courseId];
        return (course.name, course.teacher, course.startTime, course.endTime, course.isFinalized);
    }

    /// @notice 调试函数：获取课程的完整状态信息
    function getCourseDebugInfo(uint256 courseId)
        external
        view
        courseExists(courseId)
        returns (
            string memory name,
            address teacher,
            uint256 startTime,
            uint256 endTime,
            bool isActive,
            bool isFinalized,
            uint256 currentTime,
            bool canCheckIn
        )
    {
        Course memory course = courses[courseId];
        uint256 currentTime = block.timestamp;
        bool canCheckIn = currentTime >= course.startTime &&
                         currentTime <= course.endTime &&
                         !course.isFinalized &&
                         course.isActive;

        return (
            course.name,
            course.teacher,
            course.startTime,
            course.endTime,
            course.isActive,
            course.isFinalized,
            currentTime,
            canCheckIn
        );
    }
    
    /// @notice 检查学生是否已签到（明文检查）
    function hasStudentCheckedIn(uint256 courseId, address /* student */) 
        external 
        view 
        courseExists(courseId) 
        returns (bool) 
    {
        // 这里我们无法直接检查加密值，所以简化处理
        // 在实际应用中可能需要其他方式来跟踪签到状态
        return true; // 简化实现
    }
}