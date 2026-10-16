// eslint-disable-next-line e18e/ban-dependencies -- 显式恢复只读系统进程身份，不启动或关闭 IDE。
import { execa } from 'execa'

export { readDarwinKernelPaths } from './darwinKernelPaths'

export interface DarwinProcessState {
  pid: number
  started: string
  zombie: boolean
}

const options = { timeout: 10_000, reject: false, env: { LC_ALL: 'C' } } as const

/** ps 仅用于 PID、启动时间和僵尸状态，不能用可修改的 comm 代替实际可执行文件。 */
export async function readDarwinProcessStates(): Promise<DarwinProcessState[]> {
  const inspection = execa('/bin/ps', ['-axo', 'pid=,stat=,lstart='], options)
  const inspectorPid = inspection.pid
  const result = await inspection
  if (result.exitCode !== 0 || result.stderr?.trim() || !result.stdout.trim()) {
    throw new Error('Installation-exit recovery could not read the complete process inventory.')
  }
  const records = result.stdout.trim().split(/\r?\n/).map((line) => {
    const match = /^\s*(\d+)\s+(\S+)\s+(\w{3}\s+\w{3}\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s*$/.exec(line)
    const pid = Number(match?.[1])
    if (!match || !Number.isSafeInteger(pid) || pid <= 0) {
      throw new Error('Installation-exit recovery found an unverifiable process inventory entry.')
    }
    return { pid, zombie: match[2]!.startsWith('Z'), started: match[3]!.replace(/\s+/g, ' ') }
  })
  if (new Set(records.map(record => record.pid)).size !== records.length) {
    throw new Error('Installation-exit recovery found duplicate process identities.')
  }
  // 只排除本次显式启动的系统采样器 PID，不按名称排除其他进程。
  return records.filter(record => record.pid !== inspectorPid)
}

/** 已删除可执行文件无法经 proc_pidpath 读取时，核验全部 program-text 映像而非猜测首项。 */
export async function readDarwinTextImages(pid: number): Promise<string[]> {
  const result = await execa('/usr/sbin/lsof', ['-nP', '-a', '-p', String(pid), '-d', 'txt', '-F0pftn'], options)
  if (result.exitCode !== 0 || result.stderr?.trim()) {
    throw new Error(`Installation-exit recovery cannot inspect all executable text images for PID ${pid}.`, {
      cause: { exitCode: result.exitCode, stderr: result.stderr?.trim() },
    })
  }
  const fields = result.stdout.split('\0').map(field => field.replace(/^\r?\n/, '')).filter(Boolean)
  if (fields.shift() !== `p${pid}` || fields.length === 0 || fields.length % 3 !== 0) {
    throw new Error('Installation-exit recovery received incomplete executable text images.')
  }
  const paths: string[] = []
  for (let index = 0; index < fields.length; index += 3) {
    if (fields[index] !== 'ftxt' || fields[index + 1] !== 'tREG' || !fields[index + 2]?.startsWith('n')) {
      throw new Error('Installation-exit recovery received unverifiable executable text images.')
    }
    paths.push(fields[index + 2]!.slice(1))
  }
  return paths
}
