import type { ProcessIdentityGapCause } from '../types'
import type { ResourceKernelPathReader } from './darwinSnapshot'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 只采样系统进程元数据，不读取命令行或环境变量。
import { execa } from 'execa'
import { readDarwinTextImages } from '../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwin'
import { readDarwinKernelPaths } from '../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwinKernelPaths'
import { readDarwinSnapshot } from './darwinSnapshot'

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

async function readResourceFrame(deadline: number) {
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
  if (!inspectorPid || !Number.isSafeInteger(inspectorPid)) {
    throw new Error('Resource sampling could not verify its owned ps inspector.')
  }
  return { stdout: result.stdout, inspectorPid }
}

export async function readResourceRows(deadline: number) {
  const frame = await readResourceFrame(deadline)
  return parseResourceProcessRows(frame.stdout).filter(row => row.pid !== frame.inspectorPid)
}

/** 首批只准备身份，其 RSS 不用于采样；同一 helper 在独立锚点和后续闭合期间保持存活。 */
export function readInitialResourceInventory<T>(
  deadline: number,
  consume: (inventory: { rows: ProcessRow[], paths: Map<number, string | null>, afterRows: ProcessRow[] }, readPaths: ResourceKernelPathReader) => Promise<T>,
) {
  return readDarwinSnapshot(deadline, () => readResourceFrame(deadline), async (snapshot, readPaths) => {
    const rows = parseResourceProcessRows(snapshot.initial.stdout).filter(row => row.pid !== snapshot.initial.inspectorPid)
    const afterRows = parseResourceProcessRows(snapshot.after.stdout).filter(row => row.pid !== snapshot.after.inspectorPid)
    if (snapshot.paths.size !== rows.length || rows.some(row => !snapshot.paths.has(row.pid))) {
      throw new Error('Resource sampling received incomplete batch process identities.')
    }
    return consume({ rows, paths: snapshot.paths, afterRows }, readPaths)
  })
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

/** 首帧批量采集与后续有界轮次共享完全相同的稳定性、fallback 和后验门禁。 */
export async function completeResourceInspection(
  rows: ProcessRow[],
  paths: Map<number, string | null>,
  afterRows: ProcessRow[],
  deadline: number,
  afterKernel?: (rows: ProcessRow[], images: Map<number, string[]>) => Promise<void>,
  round = 1,
) {
  const after = new Map(afterRows.map(row => [row.pid, row]))
  const images = new Map<number, string[]>()
  const pending: ProcessRow[] = []
  const imageGaps = new Map<number, ProcessIdentityGapCause>()
  for (const row of rows) {
    if (!stableProcess(row, after.get(row.pid))) {
      imageGaps.set(row.pid, {
        reason: row.zombie ? 'zombie' : after.has(row.pid) ? 'identity-changed' : 'process-absent',
        firstObserved: { round, phase: row.zombie ? 'initial' : 'after-kernel' },
      })
      continue
    }
    const executable = paths.get(row.pid)
    if (validProcessImage(executable)) {
      images.set(row.pid, [executable])
    }
    else if (executable === null) {
      pending.push(row)
    }
    else {
      imageGaps.set(row.pid, { reason: 'kernel-path-unverifiable', firstObserved: { round, phase: 'after-kernel' } })
    }
  }
  await afterKernel?.(afterRows, new Map(images))
  let fallbackBudgetExhausted = false
  for (let offset = 0; offset < pending.length; offset += 4) {
    if (Date.now() >= deadline) {
      fallbackBudgetExhausted = true
      for (const row of pending.slice(offset)) {
        imageGaps.set(row.pid, { reason: 'fallback-budget-exhausted', firstObserved: { round, phase: 'fallback' } })
      }
      break
    }
    await Promise.all(pending.slice(offset, offset + 4).map(async (row) => {
      try {
        const textImages = await readDarwinTextImages(row.pid, remainingProcessBudget(deadline))
        if (textImages.length && textImages.every(validProcessImage)) {
          images.set(row.pid, textImages)
        }
        else {
          imageGaps.set(row.pid, { reason: textImages.length ? 'text-images-invalid' : 'text-images-empty', firstObserved: { round, phase: 'fallback' } })
        }
      }
      catch {
        imageGaps.set(row.pid, { reason: 'text-images-query-failed', firstObserved: { round, phase: 'fallback' } })
        // 未知归属始终保留缺口；不根据查询失败或后续退出推断其先前属于外国进程。
      }
    }))
  }
  const finalRows = await readResourceRows(deadline)
  return { paths, images, imageGaps, afterRows, finalRows, fallbackBudgetExhausted }
}

/** 复用正式映像核验；首个后验清单先交给新增身份核验，再运行最多四个并发 fallback。 */
export async function inspectResourceRows(
  rows: ProcessRow[],
  deadline: number,
  afterKernel?: (rows: ProcessRow[], images: Map<number, string[]>) => Promise<void>,
  round = 1,
  readPaths?: ResourceKernelPathReader,
) {
  const pids = rows.map(row => row.pid)
  const budget = remainingProcessBudget(deadline)
  const paths = await (readPaths ? readPaths(pids) : readDarwinKernelPaths(pids, budget))
  const afterRows = await readResourceRows(deadline)
  return completeResourceInspection(rows, paths, afterRows, deadline, afterKernel, round)
}
