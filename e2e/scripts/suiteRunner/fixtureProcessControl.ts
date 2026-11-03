import fs from 'node:fs'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

/** PID 仅用于观察；文件内容不能授予向其他进程发送终止信号的权限。 */
export function parseFixturePid(text: string): number {
  const pid = Number(text)
  if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(pid) || text !== String(pid)) {
    throw new Error('Invalid fixture process PID registration')
  }
  return pid
}

/** 原子发布前的注册保持未知，不能当作子进程已经退出。 */
export function readFixturePid(file: string): number | undefined {
  try {
    return parseFixturePid(fs.readFileSync(file, 'utf8'))
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

/** 非破坏性检查同时区分 Linux 已停止但尚未被 init 回收的僵尸。 */
export function isFixtureProcessAlive(pid: number): boolean {
  parseFixturePid(String(pid))
  try {
    process.kill(pid, 0)
    if (process.platform === 'linux') {
      const status = fs.readFileSync(`/proc/${pid}/stat`, 'utf8')
      const boundary = status.lastIndexOf(') ')
      if (boundary < 0) {
        throw new Error('Invalid fixture process status')
      }
      return !['Z', 'X'].includes(status[boundary + 2]!)
    }
    return true
  }
  catch (error) {
    if (['ESRCH', 'ENOENT'].includes((error as NodeJS.ErrnoException).code ?? '')) {
      return false
    }
    throw error
  }
}

/** 生成仅能终结自身的隔离协议；完整注册和晚启动清理均由子进程负责。 */
export function fixtureProcessSource(pidFile: string, cleanupFile: string, watchdogMs: number): string {
  if (!Number.isSafeInteger(watchdogMs) || watchdogMs <= 0) {
    throw new Error('Invalid fixture watchdog budget')
  }
  return `{
    const fixtureFs = process.getBuiltinModule('node:fs');
    const fixtureCleanup = () => {
      if (fixtureFs.existsSync(${JSON.stringify(cleanupFile)})) process.exit(0);
    };
    setInterval(fixtureCleanup, 20).unref();
    setTimeout(() => {
      process.stderr.write('Fixture process watchdog expired\\n');
      process.exit(2);
    }, ${watchdogMs}).unref();
    fixtureFs.writeFileSync(${JSON.stringify(`${pidFile}.pending`)}, String(process.pid));
    fixtureFs.renameSync(${JSON.stringify(`${pidFile}.pending`)}, ${JSON.stringify(pidFile)});
    fixtureCleanup();
  }`
}

/** 同一收尾预算内请求自退出并核验全部注册；失败时由调用方保留目录。 */
export async function requestFixtureCleanup(options: {
  cleanupFile: string
  pidFiles: string[]
  timeoutMs: number
  runnerSettled?: () => boolean
}): Promise<void> {
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 0 || options.pidFiles.length === 0) {
    throw new Error('Invalid fixture cleanup budget or registrations')
  }
  const deadline = Date.now() + options.timeoutMs
  fs.writeFileSync(options.cleanupFile, 'cleanup')
  while (true) {
    const pids = options.pidFiles.map(readFixturePid)
    if ((options.runnerSettled?.() ?? true) && pids.every(pid => pid !== undefined && !isFixtureProcessAlive(pid))) {
      return
    }
    if (Date.now() >= deadline) {
      throw new Error('Fixture cleanup was not confirmed; process registrations and cleanup marker retained')
    }
    await delay(20)
  }
}
