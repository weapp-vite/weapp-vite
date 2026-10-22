import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { connect } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { setImmediate } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it, vi } from 'vitest'
import { createNativeHostControl } from './index.mjs'

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, rm: vi.fn(actual.rm) }
})

interface NativeWatcher {
  close: () => void | Promise<void>
}

interface NativeBuilder {
  build: (environment: { config: { build: { watch: boolean } } }) => Promise<NativeWatcher>
}

interface ControlPlugin {
  configureServer: { handler: (server: NativeWatcher) => void | Promise<void> }
  buildApp: { handler: (builder: NativeBuilder) => void }
}

const fixtures: Array<{ root: string, control: Awaited<ReturnType<typeof createNativeHostControl>> }> = []

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await fixture.control.dispose()
    await rm(fixture.root, { recursive: true, force: true })
  }
})

async function fixture(configFile = 'original.config.mjs') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'native-host-control-'))
  const original = 'export default async env => ({ marker: env.mode, plugins: [{ name: "original-user-plugin" }] })\n'
  const originalConfig = path.join(root, configFile)
  await mkdir(path.dirname(originalConfig), { recursive: true })
  await writeFile(originalConfig, original)
  const control = await createNativeHostControl(root, configFile)
  fixtures.push({ root, control })
  const configModule = await import(pathToFileURL(control.configFile).href) as {
    default: (env: { mode: string }) => Promise<{ marker: string, plugins: [ControlPlugin, { name: string }] }>
  }
  return { root, original, originalConfig, control, loadConfig: configModule.default }
}

it('keeps the original config factory and closes the latest native server wrapper once', async () => {
  const current = await fixture()
  expect(path.dirname(current.control.configFile)).toBe(path.dirname(current.originalConfig))
  const config = await current.loadConfig({ mode: 'real-cli-mode' })
  expect(config.marker).toBe('real-cli-mode')
  expect(config.plugins[1].name).toBe('original-user-plugin')
  const initial = vi.fn()
  const wrapped = vi.fn()
  const server = { close: initial }
  await config.plugins[0].configureServer.handler(server)
  server.close = wrapped
  const stopping = current.control.requestClose()
  expect(current.control.requestClose()).toBe(stopping)
  await stopping
  expect(initial).not.toHaveBeenCalled()
  expect(wrapped).toHaveBeenCalledOnce()
  expect(await readFile(path.join(current.root, 'original.config.mjs'), 'utf8')).toBe(current.original)
  await current.control.dispose()
  await expect(access(current.control.configFile)).rejects.toMatchObject({ code: 'ENOENT' })
})

it('preserves a nested config directory and removes only its own sibling wrapper', async () => {
  const current = await fixture('config/nested directory/original.config.mjs')
  const configRoot = path.dirname(current.originalConfig)
  const unrelated = path.join(configRoot, 'manual.config.mjs')
  await writeFile(unrelated, 'export default { manual: true }\n')
  expect(path.dirname(current.control.configFile)).toBe(configRoot)
  expect((await current.loadConfig({ mode: 'nested' })).marker).toBe('nested')
  const source = await readFile(current.control.configFile, 'utf8')
  expect(source).toContain(pathToFileURL(current.originalConfig).href)
  expect(source).toMatch(/from "file:[^"\r\n]+\/plugin\.mjs"/)
  await current.control.dispose()
  await current.control.dispose()
  expect((await readdir(configRoot)).sort()).toEqual(['manual.config.mjs', 'original.config.mjs'])
  expect(await readFile(current.originalConfig, 'utf8')).toBe(current.original)
  expect(await readFile(unrelated, 'utf8')).toBe('export default { manual: true }\n')
})

it('keeps another control in the same config directory intact during repeated disposal', async () => {
  const current = await fixture()
  const other = await createNativeHostControl(current.root, 'original.config.mjs')
  fixtures.push({ root: current.root, control: other })
  expect(other.configFile).not.toBe(current.control.configFile)
  await current.control.dispose()
  await current.control.dispose()
  await expect(access(current.control.configFile)).rejects.toMatchObject({ code: 'ENOENT' })
  await expect(access(other.configFile)).resolves.toBeUndefined()
  expect(await readFile(current.originalConfig, 'utf8')).toBe(current.original)
  await other.dispose()
  await other.dispose()
  await expect(access(other.configFile)).rejects.toMatchObject({ code: 'ENOENT' })
})

it('waits for native watch acquisition and closes its real returned watcher', async () => {
  const current = await fixture()
  const plugin = (await current.loadConfig({ mode: 'watch' })).plugins[0]
  const created = Promise.withResolvers<NativeWatcher>()
  const close = vi.fn()
  const environment = { config: { build: { watch: true } } }
  const originalBuild = vi.fn(() => created.promise)
  const builder: NativeBuilder = { build: originalBuild }
  plugin.buildApp.handler(builder)
  const acquiring = builder.build(environment)
  let stopped = false
  const stopping = current.control.requestClose().then(() => stopped = true)
  await setImmediate()
  expect(stopped).toBe(false)
  const watcher = { close }
  created.resolve(watcher)
  expect(await acquiring).toBe(watcher)
  await stopping
  expect(originalBuild).toHaveBeenCalledExactlyOnceWith(environment)
  expect(close).toHaveBeenCalledOnce()
})

it('shares a command boundary across config reload while keeping other project tokens separate', async () => {
  const first = await fixture()
  const second = await fixture()
  const firstClose = vi.fn()
  const replacementClose = vi.fn()
  const secondClose = vi.fn()
  await (await first.loadConfig({ mode: 'before' })).plugins[0].configureServer.handler({ close: firstClose })
  await (await first.loadConfig({ mode: 'after' })).plugins[0].configureServer.handler({ close: replacementClose })
  await (await second.loadConfig({ mode: 'other' })).plugins[0].configureServer.handler({ close: secondClose })
  await first.control.requestClose()
  expect(firstClose).toHaveBeenCalledOnce()
  expect(replacementClose).toHaveBeenCalledOnce()
  expect(secondClose).not.toHaveBeenCalled()
  await second.control.requestClose()
  expect(secondClose).toHaveBeenCalledOnce()
})

it('rejects an unconnected shutdown request when disposed and shares repeated disposal', async () => {
  const current = await fixture()
  const stopping = current.control.requestClose()
  const rejected = expect(stopping).rejects.toThrow('disposed before its cleanup receipt')
  const disposing = current.control.dispose()
  expect(current.control.dispose()).toBe(disposing)
  await disposing
  await rejected
  expect(current.control.requestClose()).toBe(stopping)
  await expect(access(current.control.configFile)).rejects.toMatchObject({ code: 'ENOENT' })
})

it('retains failed temporary-config removal for a later disposal retry', async () => {
  const current = await fixture()
  const failure = new Error('temporary configuration remains in use')
  vi.mocked(rm).mockRejectedValueOnce(failure)
  const disposing = current.control.dispose()
  expect(current.control.dispose()).toBe(disposing)
  await expect(disposing).rejects.toBe(failure)
  await expect(access(current.control.configFile)).resolves.toBeUndefined()
  const retried = current.control.dispose()
  expect(retried).not.toBe(disposing)
  await retried
  await expect(access(current.control.configFile)).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await readFile(current.originalConfig, 'utf8')).toBe(current.original)
})

it('retries owned resource removal after the sibling wrapper has already been removed', async () => {
  const current = await fixture()
  const failure = new Error('temporary resource directory remains in use')
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  vi.mocked(rm).mockImplementationOnce(actual.rm).mockRejectedValueOnce(failure)
  await expect(current.control.dispose()).rejects.toBe(failure)
  await expect(access(current.control.configFile)).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await readdir(path.join(current.root, '.weapp-vite'))).toHaveLength(1)
  await current.control.dispose()
  expect(await readdir(path.join(current.root, '.weapp-vite'))).toEqual([])
  expect(await readFile(current.originalConfig, 'utf8')).toBe(current.original)
})

it('discards malformed unauthenticated messages without affecting the native peer', async () => {
  const current = await fixture()
  const source = await readFile(current.control.configFile, 'utf8')
  const serialized = source.match(/createNativeHostControlPlugin\((\{[^{}\r\n]*\})\)/)?.[1]
  expect(serialized).toBeDefined()
  const endpoint = JSON.parse(serialized!) as { port: number }
  const socket = connect({ host: '127.0.0.1', port: endpoint.port })
  await new Promise<void>((resolve, reject) => {
    socket.once('error', reject)
    socket.once('close', () => resolve())
    socket.once('connect', () => socket.end('null\n'))
  })
  const close = vi.fn()
  await (await current.loadConfig({ mode: 'valid-peer' })).plugins[0].configureServer.handler({ close })
  await current.control.requestClose()
  expect(close).toHaveBeenCalledOnce()
})

it('preserves a native peer TCP reset as the shutdown failure without an unhandled readline error', async () => {
  const current = await fixture()
  const source = await readFile(current.control.configFile, 'utf8')
  const serialized = source.match(/createNativeHostControlPlugin\((\{[^{}\r\n]*\})\)/)?.[1]
  expect(serialized).toBeDefined()
  const endpoint = JSON.parse(serialized!) as { port: number, token: string }
  const socket = connect({ host: '127.0.0.1', port: endpoint.port })
  const stopping = current.control.requestClose()
  const rejected = expect(stopping).rejects.toMatchObject({ code: 'ECONNRESET' })
  socket.once('connect', () => socket.write(`${JSON.stringify({ type: 'ready', token: endpoint.token })}\n`))
  socket.once('data', () => socket.resetAndDestroy())
  try {
    await rejected
    expect(current.control.requestClose()).toBe(stopping)
  }
  finally {
    socket.destroy()
  }
})
