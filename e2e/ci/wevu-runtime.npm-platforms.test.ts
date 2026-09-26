/* eslint-disable e18e/ban-dependencies -- 独立 npm 回归需要通过真实 CLI 构建并加载产物。 */
import { existsSync, readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { WEVU_JSX_ISLAND_HANDLER } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { readJavaScriptOutput } from '../utils/runtimeProviderOutput'
import { RUNTIME_PUBLIC_FACTORY_ROOT } from '../utils/runtimePruning'
import { CLI_PATH } from '../wevu-runtime.utils'

type RuntimeMode = 'build' | 'dev'
type Platform = 'weapp' | 'alipay'
interface NativeDefinition {
  methods?: Record<string, unknown>
  lifetimes?: Record<string, unknown>
  didMount?: unknown
  didUnmount?: unknown
  onLoad?: unknown
  [key: string]: unknown
}

const TEMP_ROOT = path.resolve(import.meta.dirname, '../../.tmp')
const WEVU_ROOT = path.resolve(import.meta.dirname, '../../packages-runtime/wevu')
const tempRoots: string[] = []

async function createNpmFixture(mode: RuntimeMode) {
  await fs.ensureDir(TEMP_ROOT)
  const root = await fs.mkdtemp(path.join(TEMP_ROOT, `wevu-npm-${mode}-`))
  tempRoots.push(root)
  for (const entry of ['src', 'project.config.json', 'project.private.config.json']) {
    await fs.copy(path.join(RUNTIME_PUBLIC_FACTORY_ROOT, entry), path.join(root, entry))
  }
  await fs.writeJson(path.join(root, 'mini.project.json'), { miniprogramRoot: 'dist' })
  await fs.writeJson(path.join(root, 'package.json'), {
    name: `wevu-npm-${mode}-fixture`,
    private: true,
    type: 'module',
    dependencies: { wevu: 'workspace:*' },
  })
  const runtimeEntry = path.join(WEVU_ROOT, mode === 'dev' ? 'dist/dev/index.mjs' : 'dist/index.mjs')
  await fs.writeFile(path.join(root, 'weapp-vite.config.ts'), [
    'import { defineConfig } from \'weapp-vite\'',
    'export default defineConfig({',
    '  weapp: {',
    '    srcRoot: \'src\',',
    `    wevu: { runtime: '${mode}' },`,
    '    npm: {',
    '      include: [\'wevu\'],',
    '      cache: false,',
    '      buildOptions(options, { name }) {',
    // npm 的整包入口独立于应用别名，显式选择已发布的两套 dist 验证二次打包。
    '        if (name === \'wevu\' && options.build?.lib) {',
    `          options.build.lib.entry = { index: ${JSON.stringify(runtimeEntry)} }`,
    '        }',
    '        return options',
    '      },',
    '    },',
    '  },',
    '})',
    '',
  ].join('\n'))
  return root
}

function loadStandaloneRuntime(entry: string) {
  const components: NativeDefinition[] = []
  const pages: NativeDefinition[] = []
  const context = createContext({
    console,
    setTimeout,
    clearTimeout,
    wx: {},
    my: {},
    Component: (definition: NativeDefinition) => components.push(definition),
    Page: (definition: NativeDefinition) => pages.push(definition),
  })
  const modules = new Map<string, { exports: Record<string, unknown> }>()
  function load(filename: string): Record<string, unknown> {
    const cached = modules.get(filename)
    if (cached) {
      return cached.exports
    }
    const module = { exports: {} }
    modules.set(filename, module)
    const requireOutput = (specifier: string) => {
      expect(specifier.startsWith('.'), `npm output must resolve its own dependency: ${specifier}`).toBe(true)
      const resolved = path.resolve(path.dirname(filename), specifier)
      const target = [resolved, `${resolved}.js`, path.join(resolved, 'index.js')].find(existsSync)
      expect(target, `missing npm output dependency: ${specifier}`).toBeDefined()
      return load(target!)
    }
    const evaluate = runInContext(`(function(module, exports, require) {\n${readFileSync(filename, 'utf8')}\n})`, context)
    evaluate(module, module.exports, requireOutput)
    return module.exports
  }
  return { runtime: load(entry) as typeof import('wevu'), components, pages }
}

function assertPublicRuntime(entry: string, platform: Platform) {
  const { runtime, components, pages } = loadStandaloneRuntime(entry)
  expect(runtime.ref(1).value).toBe(1)
  expect(runtime.defineComponent).toBeTypeOf('function')
  expect(runtime.createWevuComponent).toBeTypeOf('function')

  // 运行时选择公开工厂，保持未经过 SFC 编译器的消费者所需的保守能力。
  const factories = { defineComponent: runtime.defineComponent, createWevuComponent: runtime.createWevuComponent }
  for (const factory of Object.values(factories)) {
    factory({ data: () => ({ count: 1 }) })
  }
  expect(components).toHaveLength(2)
  for (const definition of components) {
    expect(definition.methods?.[WEVU_JSX_ISLAND_HANDLER]).toBeTypeOf('function')
    expect(typeof definition.didMount === 'function').toBe(platform === 'alipay')
    expect(typeof definition.didUnmount === 'function').toBe(platform === 'alipay')
    expect(typeof definition.lifetimes?.attached === 'function').toBe(platform === 'weapp')
  }
  runtime.createWevuComponent({ __wevu_isPage: true })
  expect(pages).toHaveLength(platform === 'alipay' ? 1 : 0)
  expect(components).toHaveLength(platform === 'alipay' ? 2 : 3)
  if (platform === 'alipay') {
    expect(pages[0]?.onLoad).toBeTypeOf('function')
    expect(pages[0]?.[WEVU_JSX_ISLAND_HANDLER]).toBeTypeOf('function')
  }
}

describe('issue #1064: standalone npm platform outputs', { concurrent: false }, () => {
  afterAll(async () => {
    await Promise.all(tempRoots.map(root => fs.remove(root)))
  })

  it.each<RuntimeMode>(['build', 'dev'])('specializes the published %s runtime in standalone npm builds', async (mode) => {
    const root = await createNpmFixture(mode)
    // 本地与 CI 都覆盖两种注册协议，不受缩减后的默认平台矩阵影响。
    for (const platform of ['weapp', 'alipay'] as const) {
      await fs.remove(path.join(root, 'dist'))
      const result = await execa('node', [CLI_PATH, 'build', root, '--platform', platform], {
        cwd: root,
        all: true,
        reject: false,
      })
      expect(result.exitCode, result.all).toBe(0)
      const dist = path.join(root, 'dist')
      const npmRoot = path.join(dist, platform === 'alipay' ? 'node_modules' : 'miniprogram_npm', 'wevu')
      const npmEntry = path.join(npmRoot, 'index.js')
      expect(await fs.pathExists(npmEntry)).toBe(true)
      for (const extension of ['js', 'json', platform === 'alipay' ? 'axml' : 'wxml']) {
        expect(await fs.pathExists(path.join(dist, `pages/index/index.${extension}`))).toBe(true)
      }
      const template = await fs.readFile(path.join(dist, `pages/index/index.${platform === 'alipay' ? 'axml' : 'wxml'}`), 'utf8')
      expect(template).toContain('public-factory-page')
      expect(template).toContain(`${platform === 'alipay' ? 'onTap' : 'bindtap'}="${WEVU_JSX_ISLAND_HANDLER}"`)
      const output = await readJavaScriptOutput(npmRoot)
      expect(output.code).not.toContain('resolvePreservedNpmDirNames')
      expect(output.code).not.toContain('project.config.json')
      expect(output.code.includes('didMount')).toBe(platform === 'alipay')
      assertPublicRuntime(npmEntry, platform)
    }
  })
})
