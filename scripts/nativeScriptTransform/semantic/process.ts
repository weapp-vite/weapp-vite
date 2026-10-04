import { writeFile } from 'node:fs/promises'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 使用参数数组与父进程超时跨平台约束隔离 worker。
import { execa } from 'execa'
import { repository } from '../identity'
import { ensure } from './artifacts'

/** 父进程看门狗覆盖 VM 外异步阻塞；保留真实退出状态与原始日志。 */
export async function runSemanticProcess(args: string[], logPrefix: string, timeoutMs: number) {
  const result = await execa(process.execPath, args, {
    cwd: repository,
    env: { WEAPP_VITE_NATIVE: '0', NODE_OPTIONS: '' },
    timeout: timeoutMs,
    reject: false,
    forceKillAfterDelay: 1_000,
  })
  const status = { exitCode: result.exitCode ?? null, signal: result.signal ?? null, timedOut: result.timedOut, failed: result.failed }
  await writeFile(`${logPrefix}.log`, `${result.stdout}\n${result.stderr}`, { flag: 'wx' })
  await writeFile(`${logPrefix}.process.json`, `${JSON.stringify(status)}\n`, { flag: 'wx' })
  ensure(!result.timedOut && !result.signal && [0, 1].includes(result.exitCode ?? -1), 'Diagnostic child timed out, was signalled or returned an unsupported exit status')
  return result.exitCode!
}
