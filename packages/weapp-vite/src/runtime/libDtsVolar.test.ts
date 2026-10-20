import type { RawPlugin, VueCompilerOptions, VueLanguagePlugin } from '@vue/language-core'
import type { ConfigService, ResolvedWeappLibConfig } from './config/types'
import { createRequire } from 'node:module'
import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateVueDtsWithInternal, generateVueDtsWithVueTsc } from './libDts/generateVueDts'

const mocks = vi.hoisted(() => ({
  createVueLanguagePlugin: vi.fn((..._args: unknown[]) => ({})),
  proxyCreateProgram: vi.fn(),
  runVueTsc: vi.fn(),
}))

vi.mock('@vue/language-core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@vue/language-core')>()
  return { ...original, createVueLanguagePlugin: mocks.createVueLanguagePlugin }
})

vi.mock('@volar/typescript', () => ({ proxyCreateProgram: mocks.proxyCreateProgram }))

vi.mock('./libDts/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('./libDts/shared')>()
  return { ...original, runVueTsc: mocks.runVueTsc }
})

interface GeneratedConfig {
  compilerOptions: Record<string, unknown> & { outDir: string }
  files: string[]
  exclude?: string[]
  vueCompilerOptions: Omit<Partial<VueCompilerOptions>, 'plugins'> & { plugins?: RawPlugin[] }
}

type DtsOptions = ResolvedWeappLibConfig['dts']
type DtsMode = 'internal' | 'vue-tsc'

const require = createRequire(import.meta.url)
const tempDirs: string[] = []
let generatedConfig: GeneratedConfig | undefined
let generatedConfigPath: string | undefined

async function createFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-lib-dts-volar-'))
  tempDirs.push(root)
  const input = path.join(root, 'index.vue')
  await fs.writeFile(input, '<template><view /></template>')

  async function generate(mode: DtsMode, dts: DtsOptions = {}) {
    const libConfig: ResolvedWeappLibConfig = {
      enabled: true,
      entry: { index: 'index.vue' },
      root,
      preservePath: true,
      componentJson: 'auto',
      dts: { ...dts, mode },
    }
    const config = {
      cwd: root,
      outDir: path.join(root, 'dist'),
      absoluteSrcRoot: root,
      weappLibConfig: libConfig,
    } as ConfigService
    const entries = [{ input, outputBase: 'index' }]
    if (mode === 'vue-tsc') {
      await generateVueDtsWithVueTsc(config, libConfig, entries, libConfig.dts)
    }
    else {
      await generateVueDtsWithInternal(config, entries, libConfig.dts)
    }
  }

  async function plugin(name: string) {
    const pluginPath = path.join(root, `${name}.cjs`)
    await fs.writeFile(pluginPath, `module.exports = () => ({ version: 2.2, name: ${JSON.stringify(name)} })`)
    return require.resolve(pluginPath)
  }

  return { root, generate, plugin }
}

function internalVueOptions() {
  expect(mocks.createVueLanguagePlugin).toHaveBeenCalledTimes(1)
  return mocks.createVueLanguagePlugin.mock.calls[0]![2] as VueCompilerOptions
}

function adapter() {
  const modulePath = require.resolve('weapp-vite/volar')
  const factory = require(modulePath) as VueLanguagePlugin
  expect(factory).toBeTypeOf('function')
  return { modulePath, factory }
}

describe('lib dts Volar adapter registration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    generatedConfig = undefined
    generatedConfigPath = undefined
    mocks.runVueTsc.mockImplementation(async (_bin: string, projectPath: string) => {
      generatedConfigPath = projectPath
      generatedConfig = await fs.readJson(projectPath) as GeneratedConfig
      const parsed = ts.convertCompilerOptionsFromJson(generatedConfig.compilerOptions, path.dirname(projectPath))
      expect(parsed.errors).toEqual([])
      const configRequire = createRequire(projectPath)
      for (const plugin of generatedConfig.vueCompilerOptions.plugins ?? []) {
        expect(configRequire(typeof plugin === 'string' ? plugin : plugin.name)).toBeTypeOf('function')
      }
      await fs.outputFile(path.join(generatedConfig.compilerOptions.outDir, 'index.d.ts'), 'export {}\n')
    })
    mocks.proxyCreateProgram.mockImplementation((
      tsInstance: typeof ts,
      _createProgram: typeof ts.createProgram,
      setup: (instance: typeof ts, options: { options: ts.CompilerOptions }) => unknown,
    ) => (options: { options: ts.CompilerOptions }) => {
      setup(tsInstance, options)
      return {
        getSourceFile(fileName: string) {
          return fileName.endsWith('.vue') ? { fileName } : undefined
        },
        emit(source: { fileName: string }, writeFile: ts.WriteFileCallback) {
          writeFile(`${source.fileName}.d.ts`, 'export {}\n', false)
          return { emitSkipped: false, diagnostics: [] }
        },
      }
    })
  })

  afterEach(async () => {
    await Promise.all(tempDirs.map(dir => fs.remove(dir)))
    tempDirs.length = 0
  })

  it('loads the same CJS adapter from temporary vue-tsc config and default internal options', async () => {
    const fixture = await createFixture()
    const { modulePath, factory } = adapter()
    await fixture.generate('vue-tsc')

    expect(generatedConfig?.vueCompilerOptions.lib).toBe('wevu')
    expect(generatedConfig?.vueCompilerOptions.plugins).toEqual([modulePath])
    expect(path.isAbsolute(modulePath)).toBe(true)
    expect(path.dirname(generatedConfigPath!)).not.toBe(fixture.root)
    const configRequire = createRequire(generatedConfigPath!)
    expect(configRequire.resolve(modulePath)).toBe(modulePath)
    expect(configRequire(modulePath)).toBe(factory)

    await fixture.generate('internal')
    expect(internalVueOptions().plugins).toEqual([factory])
  })

  it('keeps vue-tsc user options and other plugins while registering the adapter once', async () => {
    const fixture = await createFixture()
    const userPlugin = await fixture.plugin('user-plugin')
    const { modulePath } = adapter()
    await fixture.generate('vue-tsc', {
      vueTsc: {
        tsconfig: { exclude: ['ignored.vue'] },
        compilerOptions: { preserveSymlinks: true },
        vueCompilerOptions: {
          lib: 'wevu',
          target: 2.7,
          strictTemplates: false,
          plugins: [userPlugin, modulePath, modulePath],
        },
      },
    })

    expect(generatedConfig?.vueCompilerOptions).toMatchObject({
      lib: 'wevu',
      target: 2.7,
      strictTemplates: false,
      plugins: [userPlugin, modulePath],
    })
    expect(generatedConfig?.compilerOptions).toMatchObject({
      declaration: true,
      emitDeclarationOnly: true,
      preserveSymlinks: true,
    })
    expect(generatedConfig?.exclude).toEqual(['ignored.vue'])
  })

  it.each(['vue', 'other-runtime'])('does not inject the adapter into vue-tsc lib=%s', async (lib) => {
    const fixture = await createFixture()
    const userPlugin = await fixture.plugin('user-plugin')
    await fixture.generate('vue-tsc', {
      vueTsc: { vueCompilerOptions: { lib, plugins: [userPlugin] } },
    })

    expect(generatedConfig?.vueCompilerOptions).toMatchObject({ lib, plugins: [userPlugin] })
  })

  it('rebases relative vue-tsc plugins while keeping object configuration and user duplicates', async () => {
    const fixture = await createFixture()
    const userPlugin = await fixture.plugin('user-plugin')
    const { modulePath } = adapter()
    await fixture.generate('vue-tsc', {
      vueTsc: {
        vueCompilerOptions: {
          plugins: [
            './user-plugin.cjs',
            { name: './user-plugin.cjs', feature: { enabled: true } },
            { name: modulePath, customBlocks: true },
            modulePath,
          ],
        },
      },
    })

    expect(generatedConfig?.vueCompilerOptions.plugins).toEqual([
      userPlugin,
      { name: userPlugin, feature: { enabled: true } },
      { name: modulePath, customBlocks: true },
    ])
  })

  it('deduplicates an adapter already parsed from tsconfig and preserves option precedence', async () => {
    const fixture = await createFixture()
    const userPlugin = await fixture.plugin('project-plugin')
    const { modulePath, factory } = adapter()
    await fs.writeJson(path.join(fixture.root, 'tsconfig.json'), {
      compilerOptions: { strict: true, preserveSymlinks: false },
      vueCompilerOptions: {
        target: 2.7,
        strictTemplates: true,
        plugins: [userPlugin, modulePath, modulePath],
      },
    })
    await fixture.generate('internal', {
      internal: {
        compilerOptions: { preserveSymlinks: true },
        vueCompilerOptions: { strictTemplates: false },
      },
    })

    expect(internalVueOptions()).toMatchObject({ lib: 'wevu', target: 2.7, strictTemplates: false })
    expect(internalVueOptions().plugins).toEqual([require(userPlugin), factory])
    expect(mocks.createVueLanguagePlugin.mock.calls[0]![1]).toMatchObject({
      strict: true,
      preserveSymlinks: true,
      declaration: true,
      emitDeclarationOnly: true,
    })
  })

  it.each(['direct', 'wrapper'])('registers the direct adapter and public wrapper once with %s first', async (first) => {
    const fixture = await createFixture()
    const { modulePath } = adapter()
    const implementationPath = require.resolve('@weapp-vite/volar')
    await fixture.generate('vue-tsc', {
      vueTsc: {
        vueCompilerOptions: {
          plugins: [
            { name: first === 'direct' ? implementationPath : modulePath, customBlocks: true },
            first === 'direct' ? modulePath : implementationPath,
          ],
        },
      },
    })

    expect(generatedConfig?.vueCompilerOptions.plugins).toEqual([{ name: modulePath, customBlocks: true }])
  })

  it('resolves raw internal plugin overrides relative to the project before adding the adapter', async () => {
    const fixture = await createFixture()
    const oldPlugin = await fixture.plugin('project-plugin')
    const rawPlugin = await fixture.plugin('override-plugin')
    const { modulePath, factory } = adapter()
    await fs.writeJson(path.join(fixture.root, 'tsconfig.json'), {
      vueCompilerOptions: { plugins: [oldPlugin], target: 2.7 },
    })
    await fixture.generate('internal', {
      internal: {
        vueCompilerOptions: {
          plugins: [{ name: './override-plugin.cjs', feature: { enabled: true } }, modulePath, modulePath],
          strictTemplates: false,
        },
      },
    })

    expect(internalVueOptions()).toMatchObject({ lib: 'wevu', target: 2.7, strictTemplates: false })
    expect(internalVueOptions().plugins).toEqual([require(rawPlugin), factory])
    expect(internalVueOptions().plugins.every(plugin => typeof plugin === 'function')).toBe(true)
    expect(internalVueOptions().plugins).not.toContain(require(oldPlugin))
    expect(require(rawPlugin).__moduleConfig).toEqual({ name: './override-plugin.cjs', feature: { enabled: true } })
  })

  it('keeps repeated internal user factories while deduplicating the adapter', async () => {
    const fixture = await createFixture()
    const userPlugin = await fixture.plugin('user-plugin')
    const { modulePath, factory } = adapter()
    await fixture.generate('internal', {
      internal: { vueCompilerOptions: { plugins: [userPlugin, userPlugin, modulePath, modulePath] } },
    })

    expect(internalVueOptions().plugins).toEqual([require(userPlugin), require(userPlugin), factory])
  })

  it.each(['vue', 'other-runtime'])('resolves user plugins without injecting the adapter for internal lib=%s', async (lib) => {
    const fixture = await createFixture()
    const userPlugin = await fixture.plugin('user-plugin')
    await fixture.generate('internal', {
      internal: { vueCompilerOptions: { lib, plugins: ['./user-plugin.cjs'] } },
    })

    expect(internalVueOptions()).toMatchObject({ lib, plugins: [require(userPlugin)] })
  })
})
