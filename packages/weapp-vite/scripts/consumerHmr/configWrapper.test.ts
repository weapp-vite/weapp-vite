import { access, mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 原生 Node ESM 子进程用于隔离 Vitest 的 URI 解析边界。
import { execa } from 'execa'
import { afterEach, expect, it } from 'vitest'
import { createSiblingPluginConfig } from './configWrapper.mjs'

const roots: string[] = []
const wrappers: Array<Awaited<ReturnType<typeof createSiblingPluginConfig>>> = []
const mergeUrl = import.meta.resolve('@weapp-core/shared')

async function loadWithNativeNode(configFile: string, env: unknown): Promise<Record<string, any>> {
  // 此边界验证 Node 的 file URL 解析；Vitest runner 会在含 # 的路径进入 Node 前错误解析 URI。
  const { stdout } = await execa(process.execPath, ['--input-type=module', '--eval', `
const { default: load } = await import(process.argv[1])
process.stdout.write(JSON.stringify(await load(JSON.parse(process.argv[2]))))
`, pathToFileURL(configFile).href, JSON.stringify(env)], { shell: false })
  return JSON.parse(stdout.trim()) as Record<string, any>
}

afterEach(async () => {
  for (const wrapper of wrappers.splice(0)) {
    await wrapper.dispose()
  }
  for (const root of roots.splice(0)) {
    await rm(root, { recursive: true, force: true })
  }
})

async function fixture(sources: string[], nested = '') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'native-config-wrapper-'))
  roots.push(root)
  const directory = path.join(root, nested)
  await mkdir(directory, { recursive: true })
  const configFiles = sources.map((_, index) => path.join(directory, `original-${index}.config.mjs`))
  await Promise.all(configFiles.map((file, index) => writeFile(file, sources[index]!)))
  const plugin = path.join(directory, 'observer.mjs')
  await writeFile(plugin, 'export const observePublication = options => ({ name: "observer", options })\n')
  const create = async (native = false) => {
    const wrapper = await createSiblingPluginConfig({
      directory,
      configFiles,
      pluginUrl: pathToFileURL(plugin).href,
      pluginExport: 'observePublication',
      pluginOptions: { sourceRoot: 'src', profilePath: path.join(root, 'profile data.jsonl') },
      mergeUrl,
    })
    wrappers.push(wrapper)
    if (native) {
      return { wrapper, load: (env: unknown) => loadWithNativeNode(wrapper.configFile, env) }
    }
    const loaded = await import(pathToFileURL(wrapper.configFile).href) as {
      default: (env: unknown) => Promise<Record<string, any>>
    }
    return { wrapper, load: loaded.default }
  }
  return { root, directory, configFiles, sources, create }
}

it.each([
  ['object', 'export default { marker: "object" }', 'object'],
  ['promise', 'export default Promise.resolve({ marker: "promise" })', 'promise'],
  ['factory', 'export default env => ({ marker: env })', undefined],
  ['async factory', 'export default async env => ({ marker: env })', undefined],
] as const)('preserves an original %s and passes through the exact env', async (_, source, marker) => {
  const current = await fixture([source])
  const wrapped = await current.create()
  const env = { command: 'serve', mode: 'test-mode', isSsrBuild: false }
  expect((await wrapped.load(env)).marker).toBe(marker ?? env)
  expect(await readFile(current.configFiles[0]!, 'utf8')).toBe(source)
})

it('preserves nested, disabled and promised plugins without flattening or resolving them', async () => {
  const current = await fixture(['export default { plugins: [[{ name: "nested" }], false, Promise.resolve({ name: "promised" })] }'])
  const config = await (await current.create()).load({})
  expect(config.plugins[0]).toMatchObject({ name: 'observer', options: { sourceRoot: 'src' } })
  expect(config.plugins[1]).toEqual([{ name: 'nested' }])
  expect(config.plugins[2]).toBe(false)
  expect(config.plugins[3]).toBeInstanceOf(Promise)
  await expect(config.plugins[3]).resolves.toEqual({ name: 'promised' })
})

it('uses the existing weapp-over-vite merge order including plugin arrays and factory env', async () => {
  const current = await fixture([
    'export default env => ({ marker: "vite", fallback: env.mode, nested: { vite: true, value: "vite" }, plugins: [{ name: "vite" }] })',
    'export default async env => ({ marker: "weapp", fromOverlay: env.mode, nested: { weapp: true, value: "weapp" }, plugins: [[{ name: "weapp" }], false] })',
  ])
  const config = await (await current.create()).load({ mode: 'actual-mode' })
  expect(config).toMatchObject({ marker: 'weapp', fallback: 'actual-mode', fromOverlay: 'actual-mode', nested: { vite: true, weapp: true, value: 'weapp' } })
  expect(config.plugins).toEqual([expect.objectContaining({ name: 'observer' }), [{ name: 'weapp' }], false, { name: 'vite' }])
})

it('imports file URLs with escaped spaces and preserves config-relative imports', async () => {
  const current = await fixture(['import { value } from "./support file.mjs"\nexport default { value, location: import.meta.url }'], 'nested directory/has # and spaces')
  await writeFile(path.join(current.directory, 'support file.mjs'), 'export const value = "relative-support"\n')
  const wrapped = await current.create(true)
  const source = await readFile(wrapped.wrapper.configFile, 'utf8')
  expect(source).toContain(pathToFileURL(current.configFiles[0]!).href)
  expect(source).not.toContain(`from ${JSON.stringify(current.configFiles[0])}`)
  expect(fileURLToPath(new URL(pathToFileURL(current.configFiles[0]!).href))).toBe(current.configFiles[0])
  expect(await wrapped.load({})).toMatchObject({ value: 'relative-support', location: pathToFileURL(await realpath(current.configFiles[0]!)).href })
  expect(path.dirname(wrapped.wrapper.configFile)).toBe(current.directory)
})

it('removes only its own sibling and leaves original bytes and another wrapper intact', async () => {
  const current = await fixture(['export default { preserved: true }'])
  const first = await current.create()
  const second = await current.create()
  const unrelated = path.join(current.directory, 'manual.config.mjs')
  await writeFile(unrelated, 'export default { manual: true }\n')
  const disposing = first.wrapper.dispose()
  expect(first.wrapper.dispose()).toBe(disposing)
  await disposing
  await first.wrapper.dispose()
  await expect(access(first.wrapper.configFile)).rejects.toMatchObject({ code: 'ENOENT' })
  await expect(access(second.wrapper.configFile)).resolves.toBeUndefined()
  expect(await readFile(current.configFiles[0]!, 'utf8')).toBe(current.sources[0])
  expect(await readFile(unrelated, 'utf8')).toBe('export default { manual: true }\n')
  expect(await readdir(current.directory)).toContain(path.basename(second.wrapper.configFile))
})

it('retains original factory failures and rejects invalid top-level arrays', async () => {
  const failing = await fixture(['export default () => { throw new Error("original factory failed") }'])
  await expect((await failing.create()).load({})).rejects.toThrow('original factory failed')
  const array = await fixture(['export default [{ name: "invalid-config" }]'])
  await expect((await array.create()).load({})).rejects.toThrow('Original Vite config must resolve to an object')
})
