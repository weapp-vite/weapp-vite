import type { ResolvedWechatDevtoolsTarget } from '../../../packages/weapp-ide-cli/src/devtoolsTarget'
import type { InstallationProcessSample, ProcessIdentityGapObservation, ResourceObservation } from './types'
import fs from 'node:fs/promises'
import process from 'node:process'
import { resolveWechatDevtoolsInstallationRoot } from '../../../packages/weapp-ide-cli/src/devtoolsTarget/host'
import { completeResourceInspection, insideInstallation, readInitialResourceInventory, readResourceRows, stableProcess, validProcessImage } from './processInventory'
import { createResourceInventory } from './processInventory/closure'
import { processGapObservation } from './processInventory/evidence'
import { observedPreparationMembers } from './processInventory/preparation'

export { parseResourceProcessRows } from './processInventory'

/** 准备身份后无条件固定一次 RSS 锚点，共用一个 helper 及三轮内核批次，不重采样碰绿。 */
export async function sampleInstallationProcesses(target: ResolvedWechatDevtoolsTarget, platform = process.platform): Promise<ResourceObservation<InstallationProcessSample>> {
  if (platform !== 'darwin') {
    return { status: 'unavailable', reason: `Selected-installation RSS sampling is not implemented for ${platform}.` }
  }
  try {
    const samplingStartedAt = new Date().toISOString()
    const deadline = Date.now() + 10_000
    const installationRoot = await fs.realpath(resolveWechatDevtoolsInstallationRoot(target, platform))
    const { before, paths, imageGaps, fallbackBudgetExhausted, inventory } = await readInitialResourceInventory(deadline, async ({ rows: preparation, paths: initialPaths, afterRows }, readPaths) => {
      const closure = createResourceInventory({ initial: preparation, installationRoot, deadline, readPaths })
      const inspection = await completeResourceInspection(preparation, initialPaths, afterRows, deadline, closure.afterInitialKernel)
      closure.completePreparation(inspection.finalRows, inspection.images, inspection.imageGaps)
      // 准备清单中的 RSS 全部丢弃；此处无条件读取一次，后续清单不得替换或补加 RSS。
      const before = await readResourceRows(deadline)
      const preparationMembers = observedPreparationMembers(preparation, initialPaths, inspection.images, installationRoot)
      closure.freezeRssAnchor(before, preparationMembers)
      const inventory = await closure.close(await readResourceRows(deadline), inspection.images)
      return { before, ...inspection, inventory }
    })
    const { final, images } = inventory
    const members = new Map<number, 'installation-image' | 'descendant'>()
    let unclassifiedProcessCount = 0
    let missingIdentityCount = 0
    const unclassifiedProcesses: ProcessIdentityGapObservation[] = []
    const missingIdentities: ProcessIdentityGapObservation[] = []
    for (const row of before) {
      const executableImages = images.get(row.pid)
      // RSS 仅来自准备后的固定锚点；后来退出不能补造该时点的负归属。
      if (!row.zombie && (!executableImages || inventory.changedProcessPids.has(row.pid))) {
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
    // 准备阶段已经看见所选映像或后代的身份，锚点前退出也不能静默消除。
    const anchor = new Map(before.map(row => [row.pid, row]))
    for (const row of inventory.preparedSelectedRows) {
      if ((!stableProcess(row, anchor.get(row.pid)) || !stableProcess(row, final.get(row.pid)) || inventory.changedProcessPids.has(row.pid))
        && !missingIdentities.some(entry => entry.pid === row.pid)) {
        missingIdentityCount++
        missingIdentities.push(processGapObservation(row, final.get(row.pid), imageGaps.get(row.pid), inventory.identityGaps.get(row.pid)))
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
      preAnchorExitedProcesses: inventory.preAnchorExitedProcesses,
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
      rssAnchor: 'single-post-preparation-ps-inventory; preparation-and-later-rows-never-contribute-rss',
      fallbackBudgetExhausted: fallbackBudgetExhausted || inventory.fallbackBudgetExhausted,
      coverage: 'selected-installation-inventory-and-descendants',
      atomicity: 'non-atomic-ps-and-kernel-path-samples; seconds-resolution-start-time-is-not-ownership-proof',
    } }
  }
  catch (error) {
    return { status: 'unavailable', reason: error instanceof Error ? error.message : String(error) }
  }
}
