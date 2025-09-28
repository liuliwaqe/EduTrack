// 自动生成的地址文件 - 请勿手动修改
// Generated from deployments directory

export const MaskedAttendanceAddresses = {
  "31337": {
    "address": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "chainId": 31337,
    "chainName": "localhost",
    "blockNumber": 3,
    "transactionHash": "0x3ccbfc94cd0a330d8df8db97caf00af5eabdea8328e48017d1734f961edef527"
  },
  "11155111": {
    "address": "0x1F01602e68Ee458eD2cc3aBE47E0b89EdbDc73bC",
    "chainId": 11155111,
    "chainName": "sepolia",
    "blockNumber": 9295676,
    "transactionHash": "0x4b35860a51be31d7be9dd4adb02d4f860e8434abea7d4900e064034af66296cb"
  }
} as const;

export type MaskedAttendanceAddressesType = typeof MaskedAttendanceAddresses;

// 辅助函数：根据链ID获取合约地址
export function getMaskedAttendanceAddress(chainId: number): string | undefined {
  const deployment = MaskedAttendanceAddresses[chainId.toString() as keyof typeof MaskedAttendanceAddresses];
  return deployment?.address;
}

// 辅助函数：检查链是否支持
export function isChainSupported(chainId: number): boolean {
  return chainId.toString() in MaskedAttendanceAddresses;
}
