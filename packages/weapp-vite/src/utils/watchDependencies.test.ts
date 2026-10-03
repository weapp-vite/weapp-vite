import type { Plugin, ResolvedConfig } from 'vite'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { expect, it, vi } from 'vitest'
import { captureWatchDependencies } from './watchDependencies'

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
