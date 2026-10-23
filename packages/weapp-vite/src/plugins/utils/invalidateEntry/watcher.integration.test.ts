import type { FSWatcher } from 'chokidar'
import type { CompilerContext } from '../../../context'
import { once } from 'node:events'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import chokidar from 'chokidar'
import { afterEach, expect, it, vi } from 'vitest'
import { ensureSidecarWatcher } from './watcher'

const invalidate = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('./sidecar', () => ({ invalidateEntryForSidecar: invalidate }))

const cleanups: (() => Promise<unknown>)[] = []
afterEach(async () => {
  for (const cleanup of cleanups.reverse()) {
    await cleanup()
  }
  cleanups.length = 0
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  invalidate.mockClear()
})

it.each([true, false])('discovers existing and newly created sidecars with the installed Chokidar (polling: %s)', async (usePolling) => {
  vi.stubEnv('VITEST', '')
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('WEAPP_VITE_DISABLE_SIDECAR_WATCH', '0')
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-sidecar-'))
  cleanups.push(() => rm(root, { recursive: true, force: true }))
  const source = path.join(root, 'src')
  const nested = path.join(source, 'native')
  const output = path.join(source, 'dist')
  const modules = path.join(source, 'node_modules')
  await Promise.all([nested, output, modules].map(directory => mkdir(directory, { recursive: true })))
  const existing = path.join(nested, 'sitemap.json')
  await writeFile(existing, '{"desc":"initial"}')
  await writeFile(path.join(nested, 'unrelated.js'), 'export {}')
  await writeFile(path.join(output, 'generated.json'), '{}')
  await writeFile(path.join(modules, 'dependency.json'), '{}')
  let watcher: FSWatcher | undefined
  const watch = chokidar.watch
  vi.spyOn(chokidar, 'watch').mockImplementation((...args) => {
    watcher = watch(...args)
    return watcher
  })
  const owners = new Map<string, { close: () => Promise<void> | void }>()
  const context = {
    configService: {
      isDev: true,
      cwd: root,
      outDir: output,
      relativeCwd: (file: string) => path.relative(root, file),
      inlineConfig: { server: { watch: { usePolling, interval: 10 } } },
    },
    runtimeState: { watcher: { sidecarWatcherMap: owners } },
    moduleGraphService: { hasModule: () => false },
  } as unknown as CompilerContext
  ensureSidecarWatcher(context, source)
  cleanups.push(async () => {
    for (const owner of owners.values()) {
      await owner.close()
    }
  })
  expect(watcher).toBeDefined()
  await once(watcher!, 'ready', { signal: AbortSignal.timeout(10_000) })
  expect(watcher!.getWatched()[nested]).toContain('sitemap.json')
  expect(watcher!.getWatched()[nested]).not.toContain('unrelated.js')
  expect(watcher!.getWatched()[output]).toBeUndefined()
  expect(watcher!.getWatched()[modules]).toBeUndefined()
  invalidate.mockClear()
  const eventPath = (file: string) => file.replaceAll('\\', '/')
  await writeFile(existing, '{"desc":"changed"}')
  await expect.poll(() => invalidate.mock.calls).toContainEqual([context, eventPath(existing), 'update', expect.objectContaining({ isActive: expect.any(Function) })])
  const created = path.join(nested, 'new-page.axml')
  await writeFile(created, '<view>new native page</view>')
  await expect.poll(() => invalidate.mock.calls).toContainEqual([context, eventPath(created), 'create', expect.objectContaining({ isActive: expect.any(Function) })])
  await rm(created)
  await expect.poll(() => invalidate.mock.calls).toContainEqual([context, eventPath(created), 'delete', expect.objectContaining({ isActive: expect.any(Function) })])
}, 20_000)
