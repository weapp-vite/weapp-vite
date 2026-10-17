import type { Plugin, PluginContext, ResolvedConfig } from 'vite'
import type { MutableCompilerContext } from '../context'
import { mkdirSync, utimesSync, writeFileSync } from 'node:fs'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import chokidar from 'chokidar'
import { expect, it, vi } from 'vitest'
import { subscribeAutoRoutesTopology } from '../runtime/autoRoutesPlugin/topology'
import { createRuntimeState } from '../runtime/runtimeState'
import { normalizeWatchPath } from '../utils/path'
import { autoRoutes } from './autoRoutes'

it.each(['page-directory', 'pages-root'])('publishes pages when snapshots rediscover a restored %s', async (removed) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'auto-routes-watch-')))
  const pages = path.join(root, 'src/pages')
  const directory = path.join(pages, 'restored')
  const file = path.join(directory, 'index.js')
  const normalizedFile = normalizeWatchPath(file)
  let directoryMtime = Date.now() / 1000
  const markDirectoryMutation = (directory: string) => {
    // ext4 新增条目时目录 size 可能不变；同 tick 保存也可能保留 mtime。
    // polling 需要可观察的 stat 变化，显式单调推进父目录 mtime，不能靠等待碰运气。
    directoryMtime = Math.max(directoryMtime + 1, Date.now() / 1000 + 1)
    utimesSync(directory, directoryMtime, directoryMtime)
  }
  mkdirSync(pages, { recursive: true })
  writeFileSync(path.join(pages, 'initial.js'), 'Page({})')
  let directories = [pages]
  let signature = 0
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: {
      cwd: root,
      absoluteSrcRoot: path.join(root, 'src'),
      isDev: true,
      inlineConfig: { server: { watch: { usePolling: true, interval: 50 } } },
      relativeCwd: (value: string) => path.relative(root, value),
      weappViteConfig: { autoRoutes: true },
      packageInfo: { rootPath: root },
    },
    autoRoutesService: {
      isEnabled: () => true,
      getWatchDirectories: () => directories,
      isPageDeclarationSource: () => false,
      getPageDeclarationOwners: () => [],
      getSignature: () => String(signature),
      handleFileChange: async () => {
        signature += 1
        return true
      },
    },
  } as unknown as MutableCompilerContext
  const watch = vi.spyOn(chokidar, 'watch')
  const changes: Array<{ file: string, event: string }> = []
  const release = subscribeAutoRoutesTopology(ctx, change => changes.push({ ...change, file: normalizeWatchPath(change.file) }))
  const pageChanges = () => changes.filter(change => change.file === normalizedFile)
  const snapshot = () => {
    const plugin = autoRoutes(ctx)[0] as Plugin
    plugin.configResolved?.({ command: 'build' } as ResolvedConfig)
    plugin.buildStart?.call({} as PluginContext)
  }
  try {
    snapshot()
    const watcher = watch.mock.results[0]!.value as ReturnType<typeof chokidar.watch>
    await new Promise<void>(resolve => watcher.once('ready', resolve))
    // ready 只保证首次扫描完成，libuv polling 的首个 stat 样本仍可能尚未建立。
    // 用非路由文件的公开 add 事件确认父目录已实际轮询，关键页面仍只写入一次。
    const pollingFiles = new Set([path.join(root, 'src/polling-ready.txt'), path.join(pages, 'polling-ready.txt')].map(normalizeWatchPath))
    const observedPollingFiles = new Set<string>()
    const observePollingFile = (file: string) => {
      const normalized = normalizeWatchPath(file)
      if (pollingFiles.has(normalized)) {
        observedPollingFiles.add(normalized)
      }
    }
    watcher.on('add', observePollingFile)
    try {
      for (const file of pollingFiles) {
        writeFileSync(file, 'polling-ready')
      }
      await expect.poll(() => {
        for (const file of pollingFiles) {
          if (!observedPollingFiles.has(file)) {
            markDirectoryMutation(path.dirname(file))
          }
        }
        return observedPollingFiles.size
      }, { timeout: 10_000 }).toBe(pollingFiles.size)
    }
    finally {
      watcher.off('add', observePollingFile)
    }
    expect(changes).toEqual([])
    for (const stage of ['new', 'restored']) {
      // 同一轮文件保存后立刻构建快照，不能靠额外等待让物理 watcher 抢先发现。
      mkdirSync(directory, { recursive: true })
      writeFileSync(file, `Page({ data: { message: '${stage}' } })`)
      markDirectoryMutation(pages)
      markDirectoryMutation(path.dirname(pages))
      directories = [directory, pages]
      snapshot()
      await expect.poll(() => pageChanges().at(-1), { timeout: 10_000 }).toMatchObject({ file: normalizedFile, event: 'create' })
      await rm(removed === 'pages-root' ? pages : directory, { recursive: true })
      markDirectoryMutation(removed === 'pages-root' ? path.dirname(pages) : pages)
      await expect.poll(() => pageChanges().at(-1), { timeout: 10_000 }).toMatchObject({ file: normalizedFile, event: 'delete' })
    }
    expect(pageChanges().map(change => change.event)).toEqual(['create', 'delete', 'create', 'delete'])
    expect(watch).toHaveBeenCalledOnce()
  }
  finally {
    release()
    await Promise.all([...ctx.runtimeState.watcher.sidecarWatcherMap.values()].map(watcher => watcher.close()))
    watch.mockRestore()
    await rm(root, { recursive: true, force: true })
  }
}, 45_000)
