import type { ViteDevServer } from 'vite'
import type { CompilerGenerateRequest } from 'weapp-tailwindcss/core'
import type { CompilerContext } from '../../context'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createCompiler } from 'weapp-tailwindcss/core'
import { getCompilerHmrHost } from '../compilerPlugin/hmr'
import { createTailwindHmrAdapter } from './hmr'

const scans = vi.hoisted(() => ({ afterScan: undefined as undefined | (() => Promise<void>) }))
vi.mock('@weapp-tailwindcss/engine', async (original) => {
  const engine = await original<typeof import('@weapp-tailwindcss/engine')>()
  return {
    ...engine,
    async resolveProjectSourceFiles(options: Parameters<typeof engine.resolveProjectSourceFiles>[0]) {
      const files = await engine.resolveProjectSourceFiles(options)
      await scans.afterScan?.()
      return files
    },
  }
})

const require = createRequire(import.meta.url)
const cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  scans.afterScan = undefined
  for (const close of cleanup.splice(0).reverse()) {
    await close()
  }
})

function gate() {
  let release!: () => void
  let arrived!: () => void
  const waiting = new Promise<void>((resolve) => {
    release = resolve
  })
  const ready = new Promise<void>((resolve) => {
    arrived = resolve
  })
  return {
    ready,
    release,
    wait: () => {
      arrived()
      return waiting
    },
  }
}

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-hmr-registration-')))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'node_modules'))
  await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
  const compiler = createCompiler({ appType: 'weapp-vite', tailwindcssBasedir: root })
  cleanup.push(() => compiler.dispose())
  const ctx = { configService: { cwd: root } } as CompilerContext
  const host = getCompilerHmrHost(ctx)
  host.onDependencyChange = vi.fn()
  const adapter = createTailwindHmrAdapter(ctx, {
    compiler: async () => compiler,
    render: async () => {},
  })
  cleanup.push(async () => adapter.dispose())
  const createRoot = async (name: string) => {
    const directory = path.join(root, name)
    const entry = path.join(directory, 'app.css')
    const source = path.join(directory, 'page.html')
    await mkdir(directory)
    await writeFile(entry, '@import "tailwindcss/utilities" source(none); @source "./*.html";')
    await writeFile(source, '<view class="w-[37px]"/>')
    const request: CompilerGenerateRequest = { id: name, scanSources: true, target: 'weapp', sourceOptions: { projectRoot: root, cssEntries: [entry] } }
    return { source, request, result: await compiler.generate(request) }
  }
  return { adapter, createRoot, root, host }
}

it.each(['remove', 'dispose'] as const)('does not restore a root when source discovery completes after %s', async (action) => {
  const { adapter, createRoot } = await fixture()
  const root = await createRoot('initial')
  const pending = gate()
  scans.afterScan = pending.wait
  const registration = adapter.rememberRoot(0, root.request, root.result)
  await pending.ready
  if (action === 'remove') {
    adapter.removeRoot(0)
  }
  else {
    adapter.dispose()
  }
  pending.release()
  await registration
  expect([...adapter.watchFiles]).toEqual([])
  expect(adapter.deferContentInvalidation(root.source)).toBe(false)
})

it('keeps the newer root when two registrations finish in reverse order', async () => {
  const { adapter, createRoot } = await fixture()
  const first = await createRoot('first')
  const second = await createRoot('second')
  const oldGate = gate()
  const newGate = gate()
  scans.afterScan = oldGate.wait
  const oldRegistration = adapter.rememberRoot(0, first.request, first.result)
  await oldGate.ready
  scans.afterScan = newGate.wait
  const newRegistration = adapter.rememberRoot(0, second.request, second.result)
  await newGate.ready
  newGate.release()
  await newRegistration
  oldGate.release()
  await oldRegistration
  expect(adapter.watchFiles.has(second.source)).toBe(true)
  expect(adapter.watchFiles.has(first.source)).toBe(false)
  expect(adapter.deferContentInvalidation(second.source)).toBe(true)
  expect(adapter.deferContentInvalidation(first.source)).toBe(false)
})

it('releases only its own watcher subscriptions when disposed', async () => {
  const { adapter } = await fixture()
  const watcher = Object.assign(new EventEmitter(), { add: vi.fn() })
  const httpServer = new EventEmitter()
  const external = vi.fn()
  watcher.on('add', external)
  adapter.configureServer({ watcher, httpServer, config: { logger: { error: vi.fn() } } } as unknown as ViteDevServer)
  expect(watcher.listenerCount('add')).toBe(2)
  adapter.dispose()
  adapter.dispose()
  expect(watcher.listeners('add')).toEqual([external])
  expect(watcher.listenerCount('change')).toBe(0)
  expect(watcher.listenerCount('unlink')).toBe(0)
  expect(httpServer.listenerCount('close')).toBe(0)
})

it.each(['remove', 'replace'] as const)('ignores a discovered source after its root is %s during scanning', async (action) => {
  const { adapter, createRoot, root, host } = await fixture()
  const initial = await createRoot('initial')
  const replacement = await createRoot('replacement')
  await adapter.rememberRoot(0, initial.request, initial.result)
  const watcher = Object.assign(new EventEmitter(), { add: vi.fn() })
  const errors = vi.fn()
  adapter.configureServer({ watcher, config: { logger: { error: errors } } } as unknown as ViteDevServer)
  const added = path.join(root, 'initial/added.html')
  await writeFile(added, '<view class="w-[53px]"/>')
  const pending = gate()
  scans.afterScan = pending.wait
  watcher.emit('add', added)
  await pending.ready
  if (action === 'remove') {
    adapter.removeRoot(0)
  }
  else {
    scans.afterScan = undefined
    await adapter.rememberRoot(0, replacement.request, replacement.result)
  }
  pending.release()
  // 待 watcher 回调完成；不以计时假设代替异步扫描的完成边界。
  await new Promise(resolve => setImmediate(resolve))
  expect(errors).not.toHaveBeenCalled()
  expect(host.readSource(added)).toBeUndefined()
  expect(host.onDependencyChange).not.toHaveBeenCalled()
  expect(adapter.deferContentInvalidation(added)).toBe(false)
})

it('rebuilds current dependency ownership while retaining files shared by another root', async () => {
  const { adapter, createRoot, root } = await fixture()
  const first = await createRoot('first')
  const second = await createRoot('second')
  const replacement = await createRoot('replacement')
  const shared = path.join(root, 'shared.css')
  const obsolete = path.join(root, 'obsolete.css')
  await Promise.all([writeFile(shared, ''), writeFile(obsolete, '')])
  await adapter.rememberRoot(0, first.request, { ...first.result, dependencies: [...first.result.dependencies, shared, obsolete] })
  await adapter.rememberRoot(1, second.request, { ...second.result, dependencies: [...second.result.dependencies, shared] })
  await adapter.rememberRoot(0, replacement.request, replacement.result)
  expect(adapter.watchFiles.has(obsolete)).toBe(false)
  expect(adapter.watchFiles.has(first.source)).toBe(false)
  expect(adapter.watchFiles.has(shared)).toBe(true)
  expect(adapter.watchFiles.has(second.source)).toBe(true)
  adapter.removeRoot(1)
  expect(adapter.watchFiles.has(shared)).toBe(false)
  expect(adapter.watchFiles.has(replacement.source)).toBe(true)
})
