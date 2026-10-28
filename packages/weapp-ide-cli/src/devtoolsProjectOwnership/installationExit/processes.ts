import type { ResolvedWechatDevtoolsTarget } from '../../devtoolsTarget'
import type { ManagedWechatInstallationExitEvidence } from '../types'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { resolveWechatDevtoolsInstallationRoot } from '../../devtoolsTarget/host'
import { readDarwinKernelPaths, readDarwinProcessStates, readDarwinTextImages } from './darwin'

/** 仅支持已验证的 macOS 全安装清单；未知平台、权限错误或不完整映像均拒绝推断退出。 */
export async function inspectExitedWechatInstallation(
  target: ResolvedWechatDevtoolsTarget,
  platform: NodeJS.Platform = process.platform,
  options: { timeoutMs?: number } = {},
): Promise<ManagedWechatInstallationExitEvidence['processInspection']> {
  if (platform !== 'darwin') {
    throw new Error('Installation-exit recovery requires the verified macOS process inventory.')
  }
  const timeoutMs = options.timeoutMs ?? 30_000
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('Installation-exit recovery requires a positive process inventory timeout.')
  }
  const deadline = performance.now() + Math.min(timeoutMs, 30_000)
  const remaining = () => {
    const timeout = Math.floor(deadline - performance.now())
    if (timeout <= 0) {
      throw new Error('Installation-exit recovery process inventory deadline expired; continuing new process activity or incomplete inspection prevents proving exit.')
    }
    return timeout
  }
  const readStates = async () => {
    const states = await readDarwinProcessStates(remaining())
    remaining()
    return states
  }
  const selectedRoot = resolveWechatDevtoolsInstallationRoot(target, platform)
  if (!selectedRoot || !path.isAbsolute(selectedRoot) || !selectedRoot.endsWith('.app') || !target.appPath.includes('/Contents/')) {
    throw new Error('Installation-exit recovery cannot resolve the selected application bundle.')
  }
  const installationRoot = await fs.realpath(selectedRoot)
  let pending = await readStates()
  // ps 的秒级启动时间与后续映像采样不是原子快照，不能证明并发 exec 或同秒 PID 复用。
  const verified = new Map<number, { started: string, zombie: boolean }>()
  let kernelPathProcessCount = 0
  let textImageProcessCount = 0
  let exitedProcessCount = 0
  let zombieProcessCount = 0
  // 新进程只增加待核验项，不重置整次清单的单调预算。
  while (true) {
    const kernelPaths = await readDarwinKernelPaths(pending.map(entry => entry.pid), remaining())
    const after = new Map((await readStates()).map(entry => [entry.pid, entry]))
    for (const entry of pending) {
      remaining()
      const current = after.get(entry.pid)
      if (!current) {
        exitedProcessCount++
        continue
      }
      if (current.started !== entry.started) {
        throw new Error('Installation-exit recovery process identity changed during inspection.')
      }
      if (entry.zombie && current.zombie) {
        zombieProcessCount++
        verified.set(entry.pid, current)
        continue
      }
      const executable = kernelPaths.get(entry.pid)
      let images: string[]
      try {
        images = executable ? [executable] : await readDarwinTextImages(entry.pid, remaining())
      }
      catch (error) {
        // 采样器读取映像前目标可能已经退出；仅独立 PID 清单确认消失才能排除。
        const latest = await readStates().then(
          states => states.find(process => process.pid === entry.pid),
          (confirmationError: unknown) => { throw new AggregateError([error, confirmationError], 'Installation-exit recovery cannot independently confirm process exit after failed image inspection.') },
        )
        if (!latest) {
          exitedProcessCount++
          continue
        }
        if (latest.started !== entry.started) {
          throw new Error('Installation-exit recovery process identity changed during inspection.', { cause: error })
        }
        throw error
      }
      remaining()
      if (!images.length) {
        throw new Error('Installation-exit recovery received no verifiable executable text images.')
      }
      for (const image of images) {
        if (!path.isAbsolute(image) || /[\r\n\0]/.test(image)) {
          throw new Error('Installation-exit recovery received an unverifiable executable image path.')
        }
        // 内核报告的是已解析的映像路径；当前文件可能受保护、已删除或已被替换，不能再次 realpath。
        const relative = path.relative(installationRoot, image)
        if (!relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))) {
          throw new Error('The selected WeChat DevTools installation still has a live process; no ownership was recovered.')
        }
      }
      if (executable) {
        kernelPathProcessCount++
      }
      else {
        textImageProcessCount++
      }
      verified.set(entry.pid, { started: entry.started, zombie: false })
    }
    const final = await readStates()
    for (const entry of final) {
      const previous = verified.get(entry.pid)
      if (previous && (previous.started !== entry.started || (previous.zombie && !entry.zombie))) {
        throw new Error('Installation-exit recovery process identity changed during inspection.')
      }
    }
    pending = final.filter(entry => !verified.has(entry.pid))
    if (!pending.length) {
      break
    }
  }
  remaining()
  return {
    platform,
    installationRoot,
    checkedAt: new Date().toISOString(),
    inspectedProcessCount: kernelPathProcessCount + textImageProcessCount,
    kernelPathProcessCount,
    textImageProcessCount,
    exitedProcessCount,
    zombieProcessCount,
    selectedProcessCount: 0,
  }
}
