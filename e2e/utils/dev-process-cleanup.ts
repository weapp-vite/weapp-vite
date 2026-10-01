import { cleanupTrackedDevProcesses } from './dev-process'

export async function cleanupResidualDevProcesses() {
  // 命令行相同不代表当前测试拥有该进程；所有平台只释放仍登记的子进程。
  await cleanupTrackedDevProcesses(2_500)
}
