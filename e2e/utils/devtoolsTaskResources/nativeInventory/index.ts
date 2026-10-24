import type { ResolvedWechatDevtoolsTarget } from '../../../../packages/weapp-ide-cli/src/devtoolsTarget'
import type { InstallationProcessSample, NativeTextImageObservationEvidence, ResourceObservation } from '../types'
import fs from 'node:fs/promises'
import { resolveWechatDevtoolsInstallationRoot } from '../../../../packages/weapp-ide-cli/src/devtoolsTarget/host'
import { prepareDarwinInspector, withDarwinInspector } from '../processInventory/darwinInspector'
import { createNativeInventory } from './closure'
import { readNativeTextImages, resolveAnchoredTextImages, textImageCandidates } from './fallback'
import { normalizeNativeFrame } from './model'
import { summarizeNativeInventory } from './summary'

/** 公开 SDK 编译完成后才开始同一十秒预算；全程只持有一个原生检查进程。 */
export async function sampleNativeInstallationProcesses(target: ResolvedWechatDevtoolsTarget): Promise<ResourceObservation<InstallationProcessSample>> {
  try {
    const installationRoot = await fs.realpath(resolveWechatDevtoolsInstallationRoot(target, 'darwin'))
    const prepared = await prepareDarwinInspector()
    const samplingStartedAt = new Date().toISOString()
    const deadline = Date.now() + 10_000
    return await withDarwinInspector(deadline, async (reader) => {
      const inventory = createNativeInventory(installationRoot)
      const textObservations: Parameters<typeof summarizeNativeInventory>[0]['textObservations'] = []
      const registerTextReads = (reads: Awaited<ReturnType<typeof readNativeTextImages>>, phase: NativeTextImageObservationEvidence['phase'], position: NativeTextImageObservationEvidence['position']) => {
        for (const [pid, read] of reads) {
          textObservations.push({ read, phase, position })
          if (read.failure) {
            inventory.cause(inventory.tracked.get(pid)!, read.failure, phase)
          }
          if (read.images) {
            inventory.observeTextImages(pid, read.images, phase)
          }
        }
        inventory.reconcileEvidence()
      }
      const prepare = normalizeNativeFrame(await reader.readFrame('prepare'))
      inventory.observe(prepare)
      const textBefore = await readNativeTextImages(textImageCandidates(prepare), deadline)
      registerTextReads(textBefore, 'prepare', 'before-anchor')
      const anchor = normalizeNativeFrame(await reader.readFrame('anchor'))
      inventory.observe(anchor)
      // 只准备阶段已有的身份才能取得包围 RSS 锚点的双 text-image 证明。
      const anchorCandidates = [...textBefore.values()].flatMap(read => anchor.rows.get(read.row.pid) ?? [])
      const textAfter = await readNativeTextImages(anchorCandidates, deadline)
      registerTextReads(textAfter, 'anchor', 'after-anchor')
      const closure1 = normalizeNativeFrame(await reader.readFrame('closure1'))
      inventory.observe(closure1)
      const anchoredProofs = resolveAnchoredTextImages({ before: textBefore, anchor, after: textAfter, final: closure1 })
      for (const proof of anchoredProofs) {
        const entry = inventory.tracked.get(proof.pid)!
        if (proof.after.failure) {
          inventory.cause(entry, proof.after.failure, 'anchor')
        }
        if (proof.imageChanged) {
          entry.changed = true
          inventory.cause(entry, 'image-changed', 'anchor')
        }
      }
      inventory.reconcileEvidence()
      inventory.classify(anchor)
      // 闭合阶段的双查询只证明新增身份的归属，绝不提供或替换任何 RSS。
      const closureCandidates = textImageCandidates(closure1)
      const closureTextBefore = await readNativeTextImages(closureCandidates, deadline)
      registerTextReads(closureTextBefore, 'closure1', 'closure-before')
      const closureTextAfter = await readNativeTextImages(closureCandidates, deadline)
      registerTextReads(closureTextAfter, 'closure1', 'closure-after')
      const closure2 = normalizeNativeFrame(await reader.readFrame('closure2'))
      inventory.observe(closure2)
      const closureProofs = resolveAnchoredTextImages({ before: closureTextBefore, anchor: closure1, after: closureTextAfter, final: closure2 })
      for (const proof of closureProofs) {
        const entry = inventory.tracked.get(proof.pid)!
        if (proof.before.failure || proof.after.failure) {
          inventory.cause(entry, proof.before.failure ?? proof.after.failure!, 'closure1')
        }
        if (proof.imageChanged) {
          entry.changed = true
          inventory.cause(entry, 'image-changed', 'closure1')
        }
      }
      inventory.reconcileEvidence()
      inventory.classify(closure1)
      inventory.classify(closure2)
      return { status: 'observed', value: summarizeNativeInventory({
        inventory,
        installationRoot,
        samplingStartedAt,
        deadline,
        textObservations,
        textProofs: [
          ...anchoredProofs.map(proof => ({ ...proof, kind: 'rss-anchor-bracket' as const })),
          ...closureProofs.map(proof => ({ ...proof, kind: 'closure-identity-bracket' as const })),
        ],
      }) }
    }, prepared)
  }
  catch (error) {
    return { status: 'unavailable', reason: error instanceof Error ? error.message : String(error) }
  }
}
