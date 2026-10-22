import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { resolveHmrRuntimeDecision } from '../hmrRuntime'
import { ClassicIdeConfigOwner } from './index'

const cleanup: Array<() => Promise<unknown>> = []

afterEach(async () => {
  vi.restoreAllMocks()
  for (const close of cleanup.splice(0).reverse()) {
    await close().catch(() => {})
  }
})

async function fixture(original?: string) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'classic-ide-config-'))
  cleanup.push(() => fs.remove(root))
  const file = path.join(root, 'project.private.config.json')
  if (original !== undefined) {
    await fs.writeFile(file, original)
  }
  const owner = new ClassicIdeConfigOwner()
  cleanup.push(() => owner.close())
  return { file, owner, journal: path.join(root, '.weapp-vite/ide-classic-project.private.config.json') }
}

it.each([
  '{"setting":{"compileHotReLoad":true}}\n',
  '{\r\n\t"setting": { "compileHotReLoad": true, "urlCheck": false }\r\n}\r\n',
  '{"setting":{"compileHotReLoad":false}}',
  '{"description":"without setting"}',
])('preserves the requested value and exact original formatting through repeated generations: %s', async (original) => {
  const { file, owner, journal } = await fixture(original)
  for (let generation = 0; generation < 3; generation++) {
    await owner.activate(file)
    expect((await fs.readJSON(file) as { setting: { compileHotReLoad: boolean } }).setting.compileHotReLoad).toBe(false)
    expect(await owner.readRequested(file)).toBe(original)
    const requested = JSON.parse(await owner.readRequested(file)) as { setting?: { compileHotReLoad?: boolean } }
    expect(resolveHmrRuntimeDecision({ platform: 'weapp', compileHotReLoad: requested.setting?.compileHotReLoad })).toEqual(
      resolveHmrRuntimeDecision({ platform: 'weapp', compileHotReLoad: (JSON.parse(original) as typeof requested).setting?.compileHotReLoad }),
    )
  }
  const closing = owner.close()
  expect(owner.close()).toBe(closing)
  await closing
  expect(await fs.readFile(file, 'utf8')).toBe(original)
  expect(await fs.pathExists(journal)).toBe(false)
})

it('removes an originally absent private config after repeated configuration preparation', async () => {
  const { file, owner } = await fixture()
  await owner.activate(file)
  await owner.activate(file)
  expect(await owner.readRequested(file)).toBe('{}')
  await owner.close()
  expect(await fs.pathExists(file)).toBe(false)
})

it('accepts a UTF-8 BOM and preserves its exact bytes with CRLF on restoration', async () => {
  const original = '\uFEFF{\r\n\t"setting": { "compileHotReLoad": true, "urlCheck": false }\r\n}\r\n'
  const { file, owner } = await fixture(original)
  await owner.activate(file)
  const installed = await fs.readFile(file, 'utf8')
  expect(installed.startsWith('\uFEFF')).toBe(true)
  expect((await fs.readJSON(file) as { setting: { compileHotReLoad: boolean } }).setting.compileHotReLoad).toBe(false)
  expect(await owner.readRequested(file)).toBe(original)
  await owner.activate(file)
  await owner.close()
  expect(await fs.readFile(file, 'utf8')).toBe(original)
})

it('does not replace the requested baseline when native publication fails before commit', async () => {
  const original = '{"setting":{"compileHotReLoad":true},"description":"active"}'
  const { file, owner } = await fixture(original)
  await owner.activate(file)
  const publication = await owner.preparePublication(file, '{"setting":{"compileHotReLoad":true},"description":"unpublished"}')
  expect(publication.commit).toBeTypeOf('function')
  expect(await owner.readRequested(file)).toBe(original)
  await owner.close()
  await expect(publication.commit!()).rejects.toThrow('已关闭')
  expect(await fs.readFile(file, 'utf8')).toBe(original)
})

it('preserves user fields and CRLF while restoring only the owned setting', async () => {
  const { file, owner } = await fixture('{\r\n  "setting": { "compileHotReLoad": true }\r\n}\r\n')
  await owner.activate(file)
  const current = await fs.readJSON(file) as { setting: Record<string, unknown>, description?: string }
  current.setting.urlCheck = false
  current.description = 'user change'
  await fs.writeFile(file, `${JSON.stringify(current, null, 2).replaceAll('\n', '\r\n')}\r\n`)
  const requested = await owner.readRequested(file)
  expect(JSON.parse(requested)).toEqual({ setting: { compileHotReLoad: true, urlCheck: false }, description: 'user change' })
  await owner.activate(file)
  await owner.close()
  expect(await fs.readFile(file, 'utf8')).toBe(requested)
  expect(requested.replaceAll('\r\n', '')).not.toContain('\n')
})

it('keeps explicit user edits to the owned value and does not recreate a user-deleted file', async () => {
  const first = await fixture('{"setting":{"compileHotReLoad":false}}')
  await first.owner.activate(first.file)
  const edited = '{"setting":{"compileHotReLoad":true,"urlCheck":false}}'
  await fs.writeFile(first.file, edited)
  expect(await first.owner.readRequested(first.file)).toBe(edited)
  await first.owner.close()
  expect(await fs.readFile(first.file, 'utf8')).toBe(edited)
  const second = await fixture('{"setting":{"compileHotReLoad":true}}')
  await second.owner.activate(second.file)
  await fs.remove(second.file)
  await second.owner.close()
  expect(await fs.pathExists(second.file)).toBe(false)
})

it('isolates projects and rejects another live owner without changing its lease', async () => {
  const first = await fixture('{"setting":{"compileHotReLoad":true}}')
  const second = await fixture('{}')
  await first.owner.activate(first.file)
  await second.owner.activate(second.file)
  const conflict = new ClassicIdeConfigOwner()
  const failure = await conflict.activate(first.file).catch((error: unknown) => error)
  expect(failure).toBeInstanceOf(Error)
  await expect(conflict.close()).rejects.toBe(failure)
  await first.owner.close()
  expect(await fs.readFile(first.file, 'utf8')).toBe('{"setting":{"compileHotReLoad":true}}')
  expect(await second.owner.readRequested(second.file)).toBe('{}')
})

it('refuses unknown journals and preserves the exact acquisition error through close', async () => {
  const { file, owner, journal } = await fixture('{}')
  await fs.outputJSON(journal, { owner: 'unrelated-owner' })
  const failure = await owner.activate(file).catch((error: unknown) => error)
  expect(failure).toMatchObject({ code: 'EEXIST' })
  await expect(owner.close()).rejects.toBe(failure)
  expect(await fs.readJSON(journal)).toEqual({ owner: 'unrelated-owner' })
  expect(await fs.readFile(file, 'utf8')).toBe('{}')
})

it('does not restore a journal whose ownership changed and retains the cleanup failure', async () => {
  const { file, owner, journal } = await fixture('{"setting":{"compileHotReLoad":true}}')
  await owner.activate(file)
  await fs.writeJSON(journal, { owner: 'replacement-owner' })
  const installed = await fs.readFile(file, 'utf8')
  const failure = await owner.close().catch((error: unknown) => error)
  await expect(owner.close()).rejects.toBe(failure)
  expect(await fs.readFile(file, 'utf8')).toBe(installed)
  expect(await fs.readJSON(journal)).toEqual({ owner: 'replacement-owner' })
})

it('keeps a failed config write as the first error and never accepts another activation', async () => {
  const { file, owner } = await fixture('{}')
  const failure = new Error('configuration write failed')
  const write = fs.writeFile.bind(fs)
  const writeFile = vi.spyOn(fs, 'writeFile').mockImplementation((target, ...args) => {
    if (target === file) {
      return Promise.reject(failure)
    }
    return write(target, ...args)
  })
  await expect(owner.activate(file)).rejects.toBe(failure)
  writeFile.mockRestore()
  await expect(owner.activate(file)).rejects.toBe(failure)
  await expect(owner.close()).rejects.toBe(failure)
  expect(await fs.readFile(file, 'utf8')).toBe('{}')
})

it('waits for an acquired write during terminal close and restores once', async () => {
  const { file, owner } = await fixture('{"setting":{"compileHotReLoad":true}}')
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const write = fs.writeFile.bind(fs)
  vi.spyOn(fs, 'writeFile').mockImplementation(async (target, ...args) => {
    if (target === file && String(args[0]).includes('false')) {
      entered.resolve()
      await release.promise
    }
    return write(target, ...args)
  })
  const activation = owner.activate(file)
  await entered.promise
  const closing = owner.close()
  expect(owner.close()).toBe(closing)
  await expect(owner.activate(file)).rejects.toThrow('已关闭')
  release.resolve()
  await activation
  await closing
  expect(await fs.readFile(file, 'utf8')).toBe('{"setting":{"compileHotReLoad":true}}')
})

it('does not classify parser or read failures as an unsupported HMR capability', async () => {
  const { file, owner } = await fixture('{"setting":{"compileHotReLoad":true}}')
  await owner.activate(file)
  const failure = new Error('read failed')
  await expect(owner.readRequested(file, async () => {
    throw failure
  })).rejects.toBe(failure)
  await expect(owner.readRequested(file, async () => '{')).rejects.toBeInstanceOf(SyntaxError)
})

it('keeps user additions to an initially absent private config while removing only the temporary flag', async () => {
  const { file, owner } = await fixture()
  await owner.activate(file)
  await fs.writeJSON(file, { setting: { compileHotReLoad: false, urlCheck: false }, description: 'user' })
  await owner.close()
  expect(await fs.readJSON(file)).toEqual({ setting: { urlCheck: false }, description: 'user' })
})

it('retains a failed journal removal and shares the same cleanup error without retrying', async () => {
  const original = '{"setting":{"compileHotReLoad":true}}'
  const { file, owner, journal } = await fixture(original)
  await owner.activate(file)
  const failure = new Error('journal removal failed')
  const remove = fs.remove.bind(fs)
  vi.spyOn(fs, 'remove').mockImplementation(async (target) => {
    if (target === journal) {
      throw failure
    }
    await remove(target)
  })
  await expect(owner.close()).rejects.toBe(failure)
  await expect(owner.close()).rejects.toBe(failure)
  expect(await fs.pathExists(journal)).toBe(true)
  expect(await fs.readFile(file, 'utf8')).toBe(original)
})
