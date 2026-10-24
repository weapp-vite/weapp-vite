import type { NativeFrame, NativeRow } from './model'
import process from 'node:process'
import { readDarwinTextImages } from '../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwin'
import { sameNativeIdentity, validNativeImage } from './model'

export interface NativeTextImageRead {
  row: NativeRow
  images: string[] | null
  startedAt: string
  endedAt: string
  failure?: 'text-images-query-failed' | 'text-images-empty' | 'text-images-invalid' | 'fallback-budget-exhausted'
}

/** 仅使用既有 text-images 查询，所有批次沿用同一截止预算且保留每次失败。 */
export async function readNativeTextImages(rows: NativeRow[], deadline: number) {
  const results = new Map<number, NativeTextImageRead>()
  for (let offset = 0; offset < rows.length; offset += 4) {
    await Promise.all(rows.slice(offset, offset + 4).map(async (row) => {
      const startedAt = process.hrtime.bigint().toString()
      let images: string[] | null = null
      let failure: NativeTextImageRead['failure']
      const budget = Math.floor(deadline - Date.now())
      if (budget <= 0) {
        failure = 'fallback-budget-exhausted'
      }
      else {
        try {
          const value = await readDarwinTextImages(row.pid, budget)
          if (!value.length) {
            failure = 'text-images-empty'
          }
          else if (!value.every(validNativeImage)) {
            failure = 'text-images-invalid'
          }
          else {
            images = [...new Set(value)].sort()
          }
        }
        catch {
          failure = 'text-images-query-failed'
        }
      }
      results.set(row.pid, { row, images, failure, startedAt, endedAt: process.hrtime.bigint().toString() })
    }))
  }
  return results
}

export function textImageCandidates(frame: NativeFrame) {
  return [...frame.rows.values()].filter(row => row.identity && !row.identity.zombie && !row.identityChanged && !row.imageChanged
    && row.finalIdentity && sameNativeIdentity(row.identity, row.finalIdentity) && !row.images)
}

/** 双映像集合包围唯一 RSS 锚点，且每个观察边界都绑定同一精确身份。 */
export function resolveAnchoredTextImages(options: {
  before: Map<number, NativeTextImageRead>
  anchor: NativeFrame
  after: Map<number, NativeTextImageRead>
  final: NativeFrame
}) {
  const proofs: Array<{ pid: number, before: NativeTextImageRead, after: NativeTextImageRead, accepted: boolean, imageChanged: boolean }> = []
  for (const [pid, before] of options.before) {
    const after = options.after.get(pid)
    if (!after) {
      continue
    }
    const anchor = options.anchor.rows.get(pid)
    const final = options.final.rows.get(pid)
    const identities = [before.row, anchor, after.row, final]
    const stable = identities.every(row => row && !row.identityChanged && !row.imageChanged && !row.identity?.zombie
      && sameNativeIdentity(before.row.identity, row.identity) && sameNativeIdentity(row.identity, row.finalIdentity))
    const directPaths = identities.flatMap(row => row ? [row.entry.pathBefore.executable, row.entry.pathAfter.executable].filter(validNativeImage) : [])
    const imageChanged = (before.images !== null && after.images !== null && JSON.stringify(before.images) !== JSON.stringify(after.images))
      || [before.images, after.images].some(images => images !== null && directPaths.some(image => !images.includes(image)))
    const accepted = stable && before.images !== null && after.images !== null && !imageChanged
    if (accepted) {
      anchor!.images = before.images
      anchor!.imageSource = 'text-images'
    }
    proofs.push({ pid, before, after, accepted, imageChanged })
  }
  return proofs
}
