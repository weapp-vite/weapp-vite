import type { FileWatchChange } from './fileWatcher'
import type { WatcherExpectedChange, WatcherVerifiedState } from './types'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { normalize } from 'pathe'

/** 对照时统一原生输入与适配器输出的分隔符，保留路径大小写和事件语义。 */
export function matchesWatcherChange(change: FileWatchChange, wanted: WatcherExpectedChange) {
  return normalize(change.file) === normalize(wanted.file)
    && change.kind === wanted.kind && (wanted.event === undefined || change.event === wanted.event)
}

function version(contents: string | Uint8Array) {
  return createHash('sha256').update(contents).digest('hex')
}

/** 公有通知没有字节版本；另行核验每次保存要求的最终磁盘内容和删除状态。 */
export async function verifyWatcherStates(root: string, expected: WatcherExpectedChange[]): Promise<WatcherVerifiedState[]> {
  return await Promise.all(expected.map(async (wanted) => {
    const expectedKind = wanted.event === 'delete' ? 'missing' : wanted.kind
    if (expectedKind === 'file' && wanted.contents === undefined) {
      throw new Error('Every expected file creation or update requires explicit contents')
    }
    const expectedVersion = expectedKind === 'file' ? version(wanted.contents!) : undefined
    const state: WatcherVerifiedState = {
      file: path.relative(root, wanted.file).replaceAll('\\', '/'),
      expectedKind,
      observedKind: 'missing',
      ...(expectedVersion ? { expectedVersion } : {}),
      verified: false,
    }
    try {
      const observed = await stat(wanted.file)
      state.observedKind = observed.isDirectory() ? 'directory' : observed.isFile() ? 'file' : 'other'
      if (observed.isFile()) {
        state.observedVersion = version(await readFile(wanted.file))
      }
    }
    catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || (error.code !== 'ENOENT' && error.code !== 'ENOTDIR')) {
        throw error
      }
      state.observedKind = 'missing'
      delete state.observedVersion
    }
    state.verified = state.expectedKind === state.observedKind && (state.expectedVersion === undefined || state.expectedVersion === state.observedVersion)
    return state
  }))
}
