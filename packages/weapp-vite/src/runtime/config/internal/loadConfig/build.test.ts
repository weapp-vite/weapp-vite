import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  configureBuildAndPlugins,
  resolveCliPlatformRuntime,
  resolveMultiPlatformProjectConfigHint,
} from './build'

const cleanupTargets = new Set<string>()

async function createTempProject(prefix: string) {
  const root = await mkdtemp(path.join(tmpdir(), prefix))
  cleanupTargets.add(root)
  return root
}

afterEach(async () => {
  await Promise.all(
    Array.from(cleanupTargets).map(async (target) => {
      await rm(target, { recursive: true, force: true })
    }),
  )
  cleanupTargets.clear()
})

describe('loadConfig build helpers', () => {
  it('resolves normalized cli platform runtime state', () => {
    expect(resolveCliPlatformRuntime(' weapp ')).toEqual({
      normalizedCliPlatform: 'weapp',
      isWebRuntime: false,
    })

    expect(resolveCliPlatformRuntime('H5')).toEqual({
      normalizedCliPlatform: 'web',
      isWebRuntime: true,
    })

    expect(resolveCliPlatformRuntime('web')).toEqual({
      normalizedCliPlatform: 'web',
      isWebRuntime: true,
    })

    expect(resolveCliPlatformRuntime(undefined)).toEqual({
      normalizedCliPlatform: undefined,
      isWebRuntime: false,
    })
  })

  it('builds multi-platform project config hint paths', () => {
    expect(resolveMultiPlatformProjectConfigHint('weapp')).toBe('config/weapp/project.config.json')
    expect(resolveMultiPlatformProjectConfigHint('alipay', 'configs')).toBe('configs/alipay/mini.project.json')
    expect(resolveMultiPlatformProjectConfigHint('swan')).toBe('config/swan/project.swan.json')
  })

  it('disables Vite OXC transform tsconfig auto discovery by default', async () => {
    const root = await createTempProject('weapp-vite-oxc-tsconfig-')
    await writeFile(path.join(root, 'tsconfig.json'), `${JSON.stringify({ include: ['src/**/*'] }, null, 2)}\n`, 'utf8')

    const config = {}
    configureBuildAndPlugins({
      config,
      pluginOnly: false,
      oxcRolldownPlugin: undefined,
      oxcVitePlugin: undefined,
      injectBuiltinAliases: vi.fn(),
      resolvedLibConfig: undefined,
      cliPlatform: 'weapp',
      projectConfigPath: undefined,
      cwd: root,
    })

    expect((config as { oxc?: { tsconfig?: unknown } }).oxc?.tsconfig).toBe(false)
    expect((config as { build?: { rolldownOptions?: { transform?: { tsconfig?: unknown } } } }).build?.rolldownOptions?.transform?.tsconfig).toBe(false)
  })

  it('disables OXC tsconfig auto discovery when the project has no tsconfig', async () => {
    const root = await createTempProject('weapp-vite-oxc-no-tsconfig-')
    const config = {}

    configureBuildAndPlugins({
      config,
      pluginOnly: false,
      oxcRolldownPlugin: undefined,
      oxcVitePlugin: undefined,
      injectBuiltinAliases: vi.fn(),
      resolvedLibConfig: undefined,
      cliPlatform: 'weapp',
      projectConfigPath: undefined,
      cwd: root,
    })

    expect((config as { oxc?: { tsconfig?: unknown } }).oxc?.tsconfig).toBe(false)
    expect((config as { build?: { rolldownOptions?: { transform?: { tsconfig?: unknown } } } }).build?.rolldownOptions?.transform?.tsconfig).toBe(false)
  })

  it('preserves explicit user OXC and transform tsconfig options', async () => {
    const root = await createTempProject('weapp-vite-oxc-explicit-tsconfig-')
    await writeFile(path.join(root, 'tsconfig.json'), '{}\n', 'utf8')
    const config = {
      oxc: {
        tsconfig: true,
      },
      build: {
        rolldownOptions: {
          transform: {
            tsconfig: true,
          },
        },
      },
    }

    configureBuildAndPlugins({
      config,
      pluginOnly: false,
      oxcRolldownPlugin: undefined,
      oxcVitePlugin: undefined,
      injectBuiltinAliases: vi.fn(),
      resolvedLibConfig: undefined,
      cliPlatform: 'weapp',
      projectConfigPath: undefined,
      cwd: root,
    })

    expect((config as { oxc?: { tsconfig?: unknown } }).oxc?.tsconfig).toBe(true)
    expect((config as { build?: { rolldownOptions?: { transform?: { tsconfig?: unknown } } } }).build?.rolldownOptions?.transform?.tsconfig).toBe(true)
  })
})
