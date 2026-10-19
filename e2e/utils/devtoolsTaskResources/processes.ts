import type { ResolvedWechatDevtoolsTarget } from '../../../packages/weapp-ide-cli/src/devtoolsTarget'
import type { InstallationProcessSample, ResourceObservation } from './types'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 只采样系统进程元数据，不读取命令行或环境变量。
import { execa } from 'execa'
import { readDarwinTextImages } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwin'
import { readDarwinKernelPaths } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwinKernelPaths'
import { resolveWechatDevtoolsInstallationRoot } from '../../../packages/weapp-ide-cli/src/devtoolsTarget/host'

interface ProcessRow {
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

async function readRows() {
  const inspection = execa('/bin/ps', ['-axo', 'pid=,ppid=,rss=,stat=,lstart='], { timeout: 10_000, reject: false, env: { LC_ALL: 'C' } })
  const inspectorPid = inspection.pid
  const result = await inspection
  if (result.exitCode !== 0 || result.stderr?.trim() || !result.stdout.trim()) {
    throw new Error('Resource sampling could not read the process inventory.')
  }
  return parseResourceProcessRows(result.stdout).filter(row => row.pid !== inspectorPid)
}

function inside(root: string, executable: string) {
  const relative = path.relative(root, executable)
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
}

function validImage(image: string | null | undefined): image is string {
  return typeof image === 'string' && path.isAbsolute(image) && !/[\r\n\0]/.test(image)
}

function stable(row: ProcessRow, current: ProcessRow | undefined) {
  return current !== undefined && current.started === row.started && current.parentPid === row.parentPid && !current.zombie && !row.zombie
}

/** 复用退出核验的映像层；最多四个系统查询并行，统一预算耗尽后不再派发。 */
async function readImages(before: ProcessRow[], after: Map<number, ProcessRow>, paths: Map<number, string | null>, deadline: number) {
  const images = new Map<number, string[]>()
  const pending: ProcessRow[] = []
  for (const row of before) {
    if (!stable(row, after.get(row.pid))) {
      continue
    }
    const executable = paths.get(row.pid)
    if (validImage(executable)) {
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
    // 每个已有查询还有自身的 10 秒硬超时；预算仅限制派发，不遗留未等待的采样进程。
    await Promise.all(pending.slice(offset, offset + 4).map(async (row) => {
      try {
        const textImages = await readDarwinTextImages(row.pid)
        if (textImages.length && textImages.every(validImage)) {
          images.set(row.pid, textImages)
        }
      }
      catch {
        // 最终 PID 清单会区分已经退出和仍然无法核验；不把失败推断为外国进程。
      }
    }))
  }
  return { images, fallbackBudgetExhausted }
}

/** 有界读取一次前后清单确认身份，不轮询、重试、启动 IDE 或猜测未知进程归属。 */
export async function sampleInstallationProcesses(target: ResolvedWechatDevtoolsTarget, platform = process.platform): Promise<ResourceObservation<InstallationProcessSample>> {
  if (platform !== 'darwin') {
    return { status: 'unavailable', reason: `Selected-installation RSS sampling is not implemented for ${platform}.` }
  }
  try {
    const samplingStartedAt = new Date().toISOString()
    const deadline = Date.now() + 10_000
    const installationRoot = await fs.realpath(resolveWechatDevtoolsInstallationRoot(target, platform))
    const before = await readRows()
    const paths = await readDarwinKernelPaths(before.map(row => row.pid))
    const after = new Map((await readRows()).map(row => [row.pid, row]))
    const { images, fallbackBudgetExhausted } = await readImages(before, after, paths, deadline)
    const final = new Map((await readRows()).map(row => [row.pid, row]))
    const members = new Map<number, 'installation-image' | 'descendant'>()
    let unclassifiedProcessCount = 0
    let missingIdentityCount = 0
    for (const row of before) {
      const executableImages = images.get(row.pid)
      // RSS 来自 before；后来退出不能补造当时的负归属，未知条目仍使完整 RSS 不可用。
      if (!row.zombie && !executableImages) {
        unclassifiedProcessCount++
      }
      if (!stable(row, final.get(row.pid))) {
        continue
      }
      if (executableImages?.some(image => inside(installationRoot, image))) {
        members.set(row.pid, 'installation-image')
      }
    }
    let added = true
    while (added) {
      added = false
      for (const row of before) {
        if (members.has(row.pid) || !members.has(row.parentPid) || !stable(row, final.get(row.pid))) {
          continue
        }
        if (images.has(row.pid)) {
          members.set(row.pid, 'descendant')
          added = true
        }
      }
    }
    // 已知所选安装的 PID 在采样中漂移，或其后代无法核验，都必须保留缺口。
    for (const row of before) {
      const executableImages = images.get(row.pid)
      const kernelImage = paths.get(row.pid)
      if ((validImage(kernelImage) && inside(installationRoot, kernelImage)) || executableImages?.some(image => inside(installationRoot, image)) || members.has(row.parentPid)) {
        if (!stable(row, final.get(row.pid)) || !executableImages) {
          missingIdentityCount++
        }
      }
    }
    const processes = before.filter(row => members.has(row.pid)).map(row => ({
      pid: row.pid,
      parentPid: row.parentPid,
      started: row.started,
      executable: paths.get(row.pid) ?? null,
      installationImages: images.get(row.pid)!.filter(image => inside(installationRoot, image)),
      rssBytes: row.rssBytes,
      membership: members.get(row.pid)!,
    }))
    const beforePids = new Set(before.map(row => row.pid))
    const uninspectedNewProcessCount = [...final.values()].filter(row => !beforePids.has(row.pid) && !row.zombie).length
    const verifiedMemberRssBytes = processes.reduce((sum, row) => sum + row.rssBytes, 0)
    return { status: 'observed', value: {
      samplingStartedAt,
      samplingCompletedAt: new Date().toISOString(),
      installationRoot,
      processes,
      verifiedMemberRssBytes,
      installationRssBytes: unclassifiedProcessCount || missingIdentityCount || uninspectedNewProcessCount
        ? { status: 'unavailable', reason: 'The non-atomic installation inventory contains unclassified, changed, or newly appeared process identities.' }
        : { status: 'observed', value: verifiedMemberRssBytes },
      unclassifiedProcessCount,
      missingIdentityCount,
      semantics: 'point-in-time-rss-not-peak',
      uninspectedNewProcessCount,
      fallbackBudgetExhausted,
      coverage: 'selected-installation-inventory-and-descendants',
      atomicity: 'non-atomic-ps-and-kernel-path-samples; seconds-resolution-start-time-is-not-ownership-proof',
    } }
  }
  catch (error) {
    return { status: 'unavailable', reason: error instanceof Error ? error.message : String(error) }
  }
}
