import type { Plugin, ResolvedConfig } from 'vite'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { build } from 'vite'
import { expect, it, vi } from 'vitest'
import { captureWatchDependencies } from './watchDependencies'

it.each([
  ['C:\\project\\app', '..\\shared\\external.json', 'C:/project/shared/external.json'],
  ['C:/project/app', 'D:\\shared\\external.json', 'D:/shared/external.json'],
  ['C:\\project\\app', 'C:/project/app/external.json', 'C:/project/app/external.json'],
])('records normalized watch identities for root %s and input %s', (root, file, expected) => {
  const register = vi.fn()
  const addWatchFile = vi.fn()
  const config = {
    root,
    plugins: [{ name: 'windows-input', buildStart(this: { addWatchFile: (file: string) => void }) { this.addWatchFile(file) } }],
  } as unknown as ResolvedConfig
  const capture = captureWatchDependencies(register)
  ;(capture.configResolved as { handler: (config: ResolvedConfig) => void }).handler(config)
  ;(config.plugins[0]!.buildStart as (this: unknown) => void).call({ addWatchFile })
  expect(addWatchFile).toHaveBeenCalledExactlyOnceWith(file)
  expect(register).toHaveBeenCalledExactlyOnceWith(expected)
})

it('preserves object hook metadata and native receivers without modifying the user plugin', async () => {
  const root = path.resolve('fixture')
  const register = vi.fn()
  const original = vi.fn(function (this: any) {
    expect(this.resolve('entry')).toBe('resolved')
    expect(this.addWatchFile('../external.json')).toBe('registered')
    return 'compiled'
  })
  const plugin: Plugin = {
    name: 'external-input',
    load: { order: 'pre', filter: { id: /external/ }, handler: original },
  }
  const config = { root, plugins: [plugin] } as ResolvedConfig
  const capture = captureWatchDependencies(register)
  const setup = capture.configResolved as { handler: (config: ResolvedConfig) => void }
  setup.handler(config)
  const context = {
    addWatchFile: vi.fn(function (this: unknown) {
      expect(this).toBe(context)
      return 'registered'
    }),
    resolve(this: unknown) {
      expect(this).toBe(context)
      return 'resolved'
    },
  }
  const load = config.plugins[0]!.load as { handler: (this: unknown, ...args: unknown[]) => unknown, order: string, filter: unknown }
  expect(await load.handler.call(context, 'external')).toBe('compiled')
  expect(register).toHaveBeenCalledWith(path.resolve(root, '../external.json'))
  expect(load).toMatchObject({ order: 'pre', filter: { id: /external/ } })
  expect(plugin.load).toMatchObject({ handler: original })
  expect(config.plugins[0]).not.toBe(plugin)
  setup.handler(config)
  expect(config.plugins[0]!.load).toBe(load)
})

it('keeps native registration errors observable and does not register rejected paths', () => {
  const register = vi.fn()
  const config = {
    root: path.resolve('fixture'),
    plugins: [{ name: 'invalid-input', buildStart(this: any) { this.addWatchFile('bad') } }],
  } as unknown as ResolvedConfig
  const capture = captureWatchDependencies(register)
  ;(capture.configResolved as { handler: (config: ResolvedConfig) => void }).handler(config)
  expect(() => (config.plugins[0]!.buildStart as (this: unknown) => void).call({
    addWatchFile() { throw new Error('invalid input') },
  })).toThrow('invalid input')
  expect(register).not.toHaveBeenCalled()
})

it.each(['plugin', 'environment'] as const)('captures dependencies from a frozen %s without changing its hooks', (placement) => {
  const root = path.resolve('fixture')
  const register = vi.fn()
  const original = vi.fn(function (this: { addWatchFile: (file: string) => void }, code: string) {
    this.addWatchFile('external.json')
    return code
  })
  const plugin = Object.freeze({ name: 'frozen-input', transform: original })
  const environmentPlugin = Object.freeze({ name: 'frozen-environment', applyToEnvironment: () => plugin })
  const config = { root, plugins: [placement === 'plugin' ? plugin : environmentPlugin] } as unknown as ResolvedConfig
  const capture = captureWatchDependencies(register)
  ;(capture.configResolved as { handler: (config: ResolvedConfig) => void }).handler(config)
  const wrapped = placement === 'plugin'
    ? config.plugins[0]!
    : (config.plugins[0]!.applyToEnvironment as () => Plugin)()
  const context = { addWatchFile: vi.fn() }
  expect((wrapped.transform as typeof original).call(context, 'export default 1')).toBe('export default 1')
  expect(register).toHaveBeenCalledExactlyOnceWith(path.join(root, 'external.json'))
  expect(context.addWatchFile).toHaveBeenCalledExactlyOnceWith('external.json')
  expect(Object.isFrozen(plugin)).toBe(true)
  expect(Object.isFrozen(environmentPlugin)).toBe(true)
  expect(plugin.transform).toBe(original)
  expect(environmentPlugin.applyToEnvironment()).toBe(plugin)
})

it.each(['plugin', 'environment', 'rolldown'] as const)('captures third-party %s dependencies in a real Vite build', async (placement) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'watch-dependencies-'))
  try {
    const external = path.join(root, 'external.json')
    await fs.writeFile(external, '"external-value"')
    await fs.writeFile(path.join(root, 'entry.js'), 'export { default } from "virtual:external"')
    const registered = new Set<string>()
    const custom: Plugin = {
      name: 'third-party-input',
      resolveId(id) {
        if (id === 'virtual:external') {
          return '\0external'
        }
      },
      load: {
        order: 'pre',
        filter: { id: /external/ },
        async handler(id) {
          if (id === '\0external') {
            this.addWatchFile(external)
            return `export default ${await fs.readFile(external, 'utf8')}`
          }
        },
      },
    }
    const result = await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [
        placement === 'plugin' ? custom : undefined,
        placement === 'environment' ? { name: 'environment-input', applyToEnvironment: async () => [custom] } : undefined,
        captureWatchDependencies(file => registered.add(file)),
      ],
      build: {
        write: false,
        minify: false,
        lib: { entry: path.join(root, 'entry.js'), formats: ['es'] },
        rolldownOptions: { plugins: placement === 'rolldown' ? [custom] : [] },
      },
    })
    expect(registered.has(external)).toBe(true)
    const output = Array.isArray(result) ? result[0]! : result
    expect('output' in output && output.output.some(file => file.type === 'chunk' && file.code.includes('external-value'))).toBe(true)
  }
  finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

it.each(['alias', 'typescript', 'json'] as const)('preserves Vite native %s plugins while capturing watch dependencies', async (feature) => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'watch-native-plugins-')))
  try {
    const entry = path.join(root, `entry.${feature === 'typescript' ? 'ts' : 'js'}`)
    await fs.writeFile(entry, feature === 'typescript'
      ? 'interface Value { label: string }; const value: Value = { label: "typed-value" }; export default value'
      : feature === 'alias' ? 'export { default } from "@/value.js"' : 'export { default } from "./value.json"')
    await fs.writeFile(path.join(root, 'value.js'), 'export default "aliased-value"')
    await fs.writeFile(path.join(root, 'value.json'), JSON.stringify({ label: 'json-value' }))
    const parsed = vi.fn()
    const result = await build({
      root,
      configFile: false,
      logLevel: 'silent',
      resolve: { alias: { '@': root } },
      plugins: [
        {
          name: 'post-transform-analysis',
          enforce: 'post',
          transform(code, id) {
            if (id.replaceAll('\\', '/') === entry.replaceAll('\\', '/')) {
              this.parse(code)
              parsed()
            }
          },
        },
        captureWatchDependencies(() => {}),
      ],
      build: { write: false, minify: false, lib: { entry, formats: ['es'] } },
    })
    expect(parsed).toHaveBeenCalledOnce()
    const output = Array.isArray(result) ? result[0]! : result
    const expected = { alias: 'aliased-value', typescript: 'typed-value', json: 'json-value' }[feature]
    expect('output' in output && output.output.some(file => file.type === 'chunk'
      && file.code.includes(expected))).toBe(true)
  }
  finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
