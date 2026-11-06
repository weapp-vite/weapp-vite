import type { NativePublicationProfileCursor, NativePublicationProfileIdentity } from '../../e2e/utils/nativePublication/files'
import type { ClassicPublicationObservation } from './classicPublicationBarrier'
import { readFile } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import { nativeIdentitySources, normalizedSource } from '../../e2e/utils/devBuildCompletion/nativeIdentity'
import { isNativePublicationProfileIdentity, nativePublicationHash } from '../../e2e/utils/nativePublication/files'
import { readHmrProfileLines } from '../../packages/weapp-vite/src/analyze/hmr/reader'

function sourceCursor(publication: ClassicPublicationObservation | undefined, sourceFile: string) {
  const file = normalizedSource(sourceFile)
  const cursors = [
    publication?.profileCursor,
    ...[...(publication?.sourcePublications ?? [])].reverse().filter(source => source.files.some(source => normalizedSource(source) === file)).map(source => source.cursor),
  ]
  const cursor = cursors.find((cursor): cursor is NativePublicationProfileCursor & { identity: NativePublicationProfileIdentity } => Boolean(cursor
    && isNativePublicationProfileIdentity(cursor.identity)
    && cursor.identity.sourceEvents.some(event => normalizedSource(event.file) === file)))
  if (!cursor) {
    throw new Error('Workspace HMR compiler profile requires the current native publication source identity.')
  }
  return { cursor, files: new Set([file]) }
}

/** 指标与正式发布使用同一冻结身份，不把同路径的内部构建归给本次保存。 */
export function selectWorkspaceHmrProfileSample(content: string, sourceFile: string, publication?: ClassicPublicationObservation) {
  const { cursor, files } = sourceCursor(publication, sourceFile)
  if (content.length < cursor.offset || nativePublicationHash(content.slice(0, cursor.offset)) !== cursor.prefixHash) {
    throw new Error('HMR profile was truncated or replaced after the native byte write')
  }
  const { samples } = readHmrProfileLines(content.slice(cursor.offset, content.lastIndexOf('\n') + 1))
  return samples.findLast(sample => sample.schemaVersion === 1
    && sample.status === 'complete'
    && sample.pipeline === 'standard'
    && sample.correlation === 'known'
    && sample.clock?.durations === 'performance.now'
    && Number.isFinite(sample.clock.timeOrigin)
    && sample.clock.timeOrigin > 0
    && nativeIdentitySources(sample, cursor.identity, files).size === files.size)
}

/** 保留原取样预算；无身份、读取失败和游标漂移均直接保留原错误。 */
export async function waitForWorkspaceHmrProfileSample(
  profilePath: string,
  sourceFile: string,
  publication: ClassicPublicationObservation | undefined,
  timeoutMs: number,
) {
  const { cursor } = sourceCursor(publication, sourceFile)
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const content = await readFile(profilePath, 'utf8')
    const sample = selectWorkspaceHmrProfileSample(content, sourceFile, publication)
    if (sample) {
      return sample
    }
    await sleep(100)
  }
  throw new Error(`Timed out waiting for the native publication compiler profile: ${cursor.identity.buildId} / ${cursor.identity.batchId}`)
}
