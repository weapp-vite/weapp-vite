import type { PluginContext } from 'rolldown'
import type { CorePluginState } from '../helpers'
import { mkdtemp, realpath, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { expect, it, vi } from 'vitest'
import { createLogicalEntryId } from '../../../moduleGraph/protocol'
import { createModuleGraphService } from '../../../moduleGraph/service'
import { invalidateFileCache, pathExists } from '../../utils/cache'
import { withCompilerSourceSnapshot } from '../../utils/sourceSnapshot'
import { createLogicalEntryLoadHook } from './logicalEntry'

vi.mock('../../../utils', () => ({
  findCssEntry: vi.fn(async () => ({ path: undefined, predictions: [] })),
  findJsEntry: vi.fn(async () => ({ path: undefined })),
  findJsonEntry: vi.fn(async () => ({ path: undefined })),
  findTemplateEntry: vi.fn(async () => ({ path: undefined })),
  findVueEntry: vi.fn(async () => undefined),
  isTemplate: (id: string) => id.endsWith('.wxml'),
}))

it.each((['page', 'component'] as const).flatMap(entryType => (['none', 'source', 'deleted'] as const).map(snapshotMode => ({ entryType, snapshotMode }))))('$entryType reload honors $snapshotMode source ownership over cached existence', async ({ entryType, snapshotMode }) => {
  const root = path.normalize(await realpath(await mkdtemp(path.join(tmpdir(), 'logical-entry-deleted-source-'))))
  const sourceId = path.join(root, 'index.js')
  const graph = createModuleGraphService()
  const loadEntry = vi.fn()
  const resolvedEntryMap = new Map()
  try {
    const source = entryType === 'page' ? 'Page({})' : 'Component({})'
    await writeFile(sourceId, source)
    const logicalId = createLogicalEntryId(sourceId, entryType)
    expect(await pathExists(sourceId)).toBe(true)
    if (snapshotMode !== 'deleted') {
      await unlink(sourceId)
    }
    // 保留真实旧缓存；删除标记场景还保留磁盘源码，验证快照拥有最终决定权。
    expect(await pathExists(sourceId)).toBe(true)
    const state = {
      resolvedEntryMap,
      loadEntry,
      entriesMap: new Map(),
      ctx: {
        configService: {
          absoluteSrcRoot: root,
          isDev: true,
          platform: 'weapp',
          weappViteConfig: { hmr: { runtime: 'classic' } },
          relativeAbsoluteSrcRoot: (id: string) => path.relative(root, id),
        },
        moduleGraphService: graph,
      },
    } as unknown as CorePluginState
    const load = () => createLogicalEntryLoadHook(state).call(
      { addWatchFile: vi.fn() } as unknown as PluginContext,
      logicalId,
    )
    const result = snapshotMode === 'none'
      ? await load()
      : await withCompilerSourceSnapshot(state.ctx.configService, new Map([[sourceId, snapshotMode === 'source' ? source : null]]), load)
    if (snapshotMode === 'source') {
      expect.soft(result?.code).toContain(JSON.stringify(sourceId))
      expect.soft(loadEntry).toHaveBeenCalledExactlyOnceWith(sourceId, entryType)
      expect.soft(resolvedEntryMap.has(sourceId)).toBe(true)
    }
    else {
      expect.soft(result).toEqual({ code: '', moduleSideEffects: 'no-treeshake' })
      expect.soft(loadEntry).not.toHaveBeenCalled()
      expect.soft(resolvedEntryMap.size).toBe(0)
    }
  }
  finally {
    invalidateFileCache(sourceId)
    graph.resetSession()
    await rm(root, { recursive: true, force: true })
  }
})
