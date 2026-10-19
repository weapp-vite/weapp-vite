import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 只采样系统进程元数据，不读取命令行或环境变量。
import { execa } from 'execa'
import { readDarwinTextImages } from '../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwin'
import { readDarwinKernelPaths } from '../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwinKernelPaths'

export interface ProcessRow {
  pid: number
  parentPid: number
  rssBytes: number
  started: string
  zombie: boolean
}

/** ps 只提供时点 RSS 和进程关系，实际安装归属始终由内核映像路径核验。 */
export function parseResourceProcessRows(stdout: string): ProcessRow[] {
  const rows = stdout.trim().split(/\r?\n/).map((line) => {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\w{3}\s+\w{3}\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s*$/.exec(line)
    const pid = Number(match?.[1])
    const parentPid = Number(match?.[2])
    const rssBytes = Number(match?.[3]) * 1024
    if (!match || !Number.isSafeInteger(pid) || pid <= 0 || !Number.isSafeInteger(parentPid) || parentPid < 0
      || !Number.isSafeInteger(rssBytes) || rssBytes < 0) {
      throw new Error('Resource sampling received an unverifiable process row.')
    }
    return { pid, parentPid, rssBytes, zombie: match[4]!.startsWith('Z'), started: match[5]!.replace(/\s+/g, ' ') }
  })
  if (new Set(rows.map(row => row.pid)).size !== rows.length) {
    throw new Error('Resource sampling received duplicate process identities.')
  }
  return rows
}

/** 所有派发共享同一截止时间；每个已派发查询也使用剩余预算并等待结束。 */
export function remainingProcessBudget(deadline: number) {
  const remaining = Math.floor(deadline - Date.now())
  if (remaining <= 0) {
    throw new Error('Resource sampling exhausted its shared process inspection budget.')
  }
  return remaining
}

export async function readResourceRows(deadline: number) {
  const inspection = execa('/bin/ps', ['-axo', 'pid=,ppid=,rss=,stat=,lstart='], {
    timeout: remainingProcessBudget(deadline),
    reject: false,
    env: { LC_ALL: 'C' },
  })
  const inspectorPid = inspection.pid
  const result = await inspection
  if (result.exitCode !== 0 || result.timedOut || result.signal || result.stderr?.trim() || !result.stdout.trim()) {
    throw new Error('Resource sampling could not read the process inventory.')
  }
  return parseResourceProcessRows(result.stdout).filter(row => row.pid !== inspectorPid)
}

export function insideInstallation(root: string, executable: string) {
  const relative = path.relative(root, executable)
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
}

export function validProcessImage(image: string | null | undefined): image is string {
  return typeof image === 'string' && path.isAbsolute(image) && !/[\r\n\0]/.test(image)
}

export function sameProcessIdentity(row: ProcessRow, current: ProcessRow) {
  return current.started === row.started && current.parentPid === row.parentPid && current.zombie === row.zombie
}

export function stableProcess(row: ProcessRow, current: ProcessRow | undefined) {
  return current !== undefined && sameProcessIdentity(row, current) && !row.zombie
}

/** 复用正式映像核验；新身份与初始身份均只查询一次，最多四个 fallback 并发。 */
export async function inspectResourceRows(rows: ProcessRow[], deadline: number) {
  const paths = await readDarwinKernelPaths(rows.map(row => row.pid), remainingProcessBudget(deadline))
  const afterRows = await readResourceRows(deadline)
  const after = new Map(afterRows.map(row => [row.pid, row]))
  const images = new Map<number, string[]>()
  const pending: ProcessRow[] = []
  for (const row of rows) {
    if (!stableProcess(row, after.get(row.pid))) {
      continue
    }
    const executable = paths.get(row.pid)
    if (validProcessImage(executable)) {
      images.set(row.pid, [executable])
    }
    else if (executable === null) {
      pending.push(row)
    }
  }
  let fallbackBudgetExhausted = false
  for (let offset = 0; offset < pending.length; offset += 4) {
    if (Date.now() >= deadline) {
      fallbackBudgetExhausted = true
      break
    }
    await Promise.all(pending.slice(offset, offset + 4).map(async (row) => {
      try {
        const textImages = await readDarwinTextImages(row.pid, remainingProcessBudget(deadline))
        if (textImages.length && textImages.every(validProcessImage)) {
          images.set(row.pid, textImages)
        }
      }
      catch {
        // 未知归属始终保留缺口；不根据查询失败或后续退出推断其先前属于外国进程。
      }
    }))
  }
  const finalRows = await readResourceRows(deadline)
  return { paths, images, afterRows, finalRows, fallbackBudgetExhausted }
}
