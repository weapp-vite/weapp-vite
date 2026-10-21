import type { ResolvedWechatDevtoolsTarget } from '../../../packages/weapp-ide-cli/src/devtoolsTarget'
import type { InstallationProcessSample, ProcessIdentityGapObservation, ResourceObservation } from './types'
import fs from 'node:fs/promises'
import process from 'node:process'
import { resolveWechatDevtoolsInstallationRoot } from '../../../packages/weapp-ide-cli/src/devtoolsTarget/host'
import { completeResourceInspection, insideInstallation, readInitialResourceInventory, stableProcess, validProcessImage } from './processInventory'
import { createResourceInventory } from './processInventory/closure'
import { processGapObservation } from './processInventory/evidence'

export { parseResourceProcessRows } from './processInventory'

/** 保留初始 RSS 锚点，仅以三轮有界清单闭合核验新增外国进程，不重采样碰绿。 */
export async function sampleInstallationProcesses(target: ResolvedWechatDevtoolsTarget, platform = process.platform): Promise<ResourceObservation<InstallationProcessSample>> {
  if (platform !== 'darwin') {
    return { status: 'unavailable', reason: `Selected-installation RSS sampling is not implemented for ${platform}.` }
  }
  try {
    const samplingStartedAt = new Date().toISOString()
    const deadline = Date.now() + 10_000
    const installationRoot = await fs.realpath(resolveWechatDevtoolsInstallationRoot(target, platform))
    const { before, paths, images, imageGaps, fallbackBudgetExhausted, inventory } = await readInitialResourceInventory(deadline, async ({ rows: before, paths: initialPaths, afterRows }, readPaths) => {
      const closure = createResourceInventory({ initial: before, installationRoot, deadline, readPaths })
      const inspection = await completeResourceInspection(before, initialPaths, afterRows, deadline, closure.afterInitialKernel)
      const inventory = await closure.close(inspection.finalRows, inspection.images)
      return { before, ...inspection, inventory }
    })
    const { final } = inventory
    const members = new Map<number, 'installation-image' | 'descendant'>()
    let unclassifiedProcessCount = 0
    let missingIdentityCount = 0
    const unclassifiedProcesses: ProcessIdentityGapObservation[] = []
    const missingIdentities: ProcessIdentityGapObservation[] = []
    for (const row of before) {
      const executableImages = images.get(row.pid)
      // RSS 来自 before；后来退出不能补造当时的负归属，未知条目仍使完整 RSS 不可用。
      if (!row.zombie && !executableImages) {
        unclassifiedProcessCount++
        unclassifiedProcesses.push(processGapObservation(row, final.get(row.pid), imageGaps.get(row.pid), inventory.identityGaps.get(row.pid)))
      }
      if (!stableProcess(row, final.get(row.pid)) || inventory.changedProcessPids.has(row.pid)) {
        continue
      }
      if (executableImages?.some(image => insideInstallation(installationRoot, image))) {
        members.set(row.pid, 'installation-image')
      }
    }
    let added = true
    while (added) {
      added = false
      for (const row of before) {
        if (members.has(row.pid) || !members.has(row.parentPid) || !stableProcess(row, final.get(row.pid)) || inventory.changedProcessPids.has(row.pid)) {
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
      if ((validProcessImage(kernelImage) && insideInstallation(installationRoot, kernelImage)) || executableImages?.some(image => insideInstallation(installationRoot, image)) || members.has(row.parentPid)) {
        if (!stableProcess(row, final.get(row.pid)) || !executableImages || inventory.changedProcessPids.has(row.pid)) {
          missingIdentityCount++
          missingIdentities.push(processGapObservation(row, final.get(row.pid), imageGaps.get(row.pid), inventory.identityGaps.get(row.pid)))
        }
      }
    }
    const processes = before.filter(row => members.has(row.pid)).map(row => ({
      pid: row.pid,
      parentPid: row.parentPid,
      started: row.started,
      executable: paths.get(row.pid) ?? null,
      installationImages: images.get(row.pid)!.filter(image => insideInstallation(installationRoot, image)),
      rssBytes: row.rssBytes,
      membership: members.get(row.pid)!,
    }))
    const verifiedMemberRssBytes = processes.reduce((sum, row) => sum + row.rssBytes, 0)
    const inventoryBudgetExhausted = inventory.inventoryBudgetExhausted || Date.now() >= deadline
    const incomplete = unclassifiedProcessCount || missingIdentityCount || inventory.uninspectedNewProcessCount || inventory.newSelectedProcessCount
      || inventory.identityChangedProcessCount || inventoryBudgetExhausted || inventory.inventoryInspectionError
    return { status: 'observed', value: {
      samplingStartedAt,
      samplingCompletedAt: new Date().toISOString(),
      installationRoot,
      processes,
      verifiedMemberRssBytes,
      installationRssBytes: incomplete
        ? { status: 'unavailable', reason: 'The non-atomic installation inventory contains unclassified, changed, or newly appeared process identities.' }
        : { status: 'observed', value: verifiedMemberRssBytes },
      unclassifiedProcessCount,
      missingIdentityCount,
      unclassifiedProcesses,
      missingIdentities,
      identityChangedProcesses: inventory.identityChangedProcesses,
      semantics: 'point-in-time-rss-not-peak',
      uninspectedNewProcessCount: inventory.uninspectedNewProcessCount,
      verifiedNewForeignProcessCount: inventory.verifiedNewForeignProcessCount,
      newSelectedProcessCount: inventory.newSelectedProcessCount,
      identityChangedProcessCount: inventory.identityChangedProcessCount,
      newProcesses: inventory.newProcesses,
      inventoryRoundCount: inventory.inventoryRoundCount,
      inventoryBudgetExhausted,
      inventoryInspectionError: inventory.inventoryInspectionError,
      samplingBudgetMs: 10_000,
      rssAnchor: 'initial-ps-inventory-only; later-rows-never-replace-or-add-rss',
      fallbackBudgetExhausted: fallbackBudgetExhausted || inventory.fallbackBudgetExhausted,
      coverage: 'selected-installation-inventory-and-descendants',
      atomicity: 'non-atomic-ps-and-kernel-path-samples; seconds-resolution-start-time-is-not-ownership-proof',
    } }
  }
  catch (error) {
    return { status: 'unavailable', reason: error instanceof Error ? error.message : String(error) }
  }
}
