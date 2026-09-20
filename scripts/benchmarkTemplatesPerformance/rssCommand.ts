/* eslint-disable-next-line e18e/ban-dependencies -- 统一限制 Windows/Unix 内存探针的子进程生命周期。 */
import { execa } from 'execa'

/** 探针失败或超时保留为不可用，不允许诊断进程无限拖延构建。 */
export async function runRssSamplingCommand(command: string, args: string[], timeoutMs = 5_000) {
  const result = await execa(command, args, {
    reject: false,
    stdin: 'ignore',
    timeout: timeoutMs,
    forceKillAfterDelay: 1_000,
  })
  return result.failed ? null : result.stdout
}
