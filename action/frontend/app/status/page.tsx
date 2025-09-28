"use client";

import { useEffect, useState } from "react";

export default function StatusPage() {
  const [nodeStatus, setNodeStatus] = useState<string>("检查中...");
  const [contractStatus, setContractStatus] = useState<string>("检查中...");

  useEffect(() => {
    const checkStatus = async () => {
      // 检查Hardhat节点
      try {
        const response = await fetch("http://localhost:8545", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "web3_clientVersion",
            params: [],
            id: 1,
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          setNodeStatus(`✅ 节点运行中: ${data.result}`);
        } else {
          setNodeStatus("❌ 节点未响应");
        }
      } catch (error) {
        setNodeStatus("❌ 无法连接到节点");
      }

      // 检查合约
      try {
        const response = await fetch("http://localhost:8545", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getCode",
            params: ["0x5FbDB2315678afecb367f032d93F642f64180aa3", "latest"],
            id: 2,
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.result && data.result !== "0x") {
            setContractStatus("✅ 合约已部署");
          } else {
            setContractStatus("❌ 合约未部署");
          }
        } else {
          setContractStatus("❌ 无法检查合约");
        }
      } catch (error) {
        setContractStatus("❌ 合约检查失败");
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="card">
          <div className="card-header">
            <h1 className="text-2xl font-bold text-center">系统状态检查</h1>
          </div>
          <div className="card-body space-y-4">
            <div>
              <h3 className="font-semibold mb-2">FHEVM Hardhat节点</h3>
              <p className="text-sm">{nodeStatus}</p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">MaskedAttendance合约</h3>
              <p className="text-sm">{contractStatus}</p>
              <p className="text-xs text-gray-500 mt-1">
                地址: 0x5FbDB2315678afecb367f032d93F642f64180aa3
              </p>
            </div>

            <div className="pt-4 border-t">
              <a 
                href="/"
                className="btn btn-primary w-full"
              >
                返回主页
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
