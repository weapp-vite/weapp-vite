import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { taroLegacyDependencies, taroQuickappCompile } from './taroLegacy'

interface RunnerOptions {
  entry: Record<string, string[]>
  sourceRoot: string
  outputRoot: string
  mode: string
  isWatch: boolean
  postcss: unknown
  quickappJSON: unknown
  isBuildQuickapp: boolean
  modifyBuildTempFileContent: (files: Record<string, { config?: object }>) => Promise<void>
  onBuildFinish: (result: { error: unknown, stats: { hasErrors: () => boolean } | null }) => void
}

function compileHarness(options: { manifest?: object, initSuccess?: boolean } = {}) {
  const appPath = path.resolve('controlled-project')
  const entry = { app: [path.join(appPath, 'src/app.jsx')] }
  const prepared = { entry, sourceRoot: 'src', outputRoot: 'out/production', postcss: { pxtransform: { enable: false } }, babel: { generatedByOfficialConfig: true }, modifyBuildTempFileContent: vi.fn() }
  const getConfigWithNamed = vi.fn(() => prepared)
  const initialize = vi.fn()
  const replacements = vi.fn()
  const process = { argv: ['node', 'compile.cjs', 'production', 'quickapp', 'out/production'], env: {}, cwd: () => appPath, exitCode: 0 }
  let received: { appPath: string, options: RunnerOptions } | undefined
  const runner = (appPath: string, options: RunnerOptions) => {
    received = { appPath, options }
    return Promise.resolve()
  }
  const defaultManifest = { package: 'org.controlled.default' }
  const requireModule = (name: string) => {
    if (name === 'path') {
      return path
    }
    if (name === 'fs') {
      return { existsSync: () => options.manifest !== undefined, readFileSync: () => JSON.stringify(options.manifest) }
    }
    if (name === '@tarojs/service/dist/Config') {
      return { default: class {
        isInitSuccess = options.initSuccess ?? true
        getConfigWithNamed = getConfigWithNamed
        constructor(config: { appPath: string }) { initialize(config) }
      } }
    }
    if (name === '@tarojs/mini-runner') {
      return { default: runner }
    }
    if (name === '@tarojs/cli/dist/util') {
      return { recursiveReplaceObjectKeys: replacements }
    }
    if (name === '@tarojs/cli/dist/config/manifest.default.json') {
      return defaultManifest
    }
    throw new Error(`Unexpected compiler dependency: ${name}`)
  }
  runInNewContext(taroQuickappCompile, { require: requireModule, process, console })
  return { appPath, entry, prepared, initialize, getConfigWithNamed, replacements, process, received, defaultManifest }
}

describe('Taro 2 official QuickApp template compilation boundary', () => {
  it('consumes the official prepared entry and mini options instead of the raw project config', () => {
    const result = compileHarness()
    expect(result.initialize).toHaveBeenCalledWith({ appPath: result.appPath })
    expect(result.getConfigWithNamed).toHaveBeenCalledWith('quickapp', 'mini')
    expect(result.received?.appPath).toBe(result.appPath)
    expect(result.received?.options.entry).toBe(result.entry)
    expect(result.received?.options).toMatchObject({ sourceRoot: 'src', outputRoot: path.join('out/production', 'src'), mode: 'production', isWatch: false, isBuildQuickapp: true, postcss: result.prepared.postcss, quickappJSON: result.defaultManifest })
    expect(() => compileHarness({ initSuccess: false })).toThrow('could not be initialized')
  })

  it('preserves the official pre-emission config replacement hook and optional project manifest', async () => {
    const manifest = { package: 'org.controlled.custom', name: 'controlled' }
    const result = compileHarness({ manifest })
    expect(result.received?.options.quickappJSON).toEqual(manifest)
    const config = { navigationBarTitleText: 'Title', window: { pageOrientation: 'landscape', backgroundColorTop: '#fff' } }
    const files = { page: { config }, component: {} }
    await result.received!.options.modifyBuildTempFileContent(files)
    expect(result.prepared.modifyBuildTempFileContent).toHaveBeenCalledWith(files)
    expect(result.replacements).toHaveBeenCalledTimes(1)
    expect(result.replacements).toHaveBeenCalledWith(config, {
      navigationBarTitleText: 'titleBarText',
      navigationBarBackgroundColor: 'titleBarBackgroundColor',
      navigationBarTextStyle: 'titleBarTextColor',
      pageOrientation: 'orientation',
      backgroundTextStyle: false,
      onReachBottomDistance: false,
      backgroundColorBottom: false,
      backgroundColorTop: false,
    })
    expect(result.prepared.modifyBuildTempFileContent.mock.invocationCallOrder[0]).toBeLessThan(result.replacements.mock.invocationCallOrder[0]!)
  })

  it('marks compiler errors as failure while keeping only fixed official QuickApp dependencies', () => {
    const result = compileHarness()
    result.received!.options.onBuildFinish({ error: null, stats: { hasErrors: () => false } })
    expect(result.process.exitCode).toBe(0)
    result.received!.options.onBuildFinish({ error: null, stats: { hasErrors: () => true } })
    expect(result.process.exitCode).toBe(1)
    const dependencies = taroLegacyDependencies('2.2.22', 'quickapp')
    expect(dependencies).toMatchObject({ '@tarojs/components-qa': '2.2.22', '@tarojs/taro-quickapp': '2.2.22', '@tarojs/service': '2.2.22', '@tarojs/helper': '2.2.22' })
    expect(taroLegacyDependencies('2.2.22', 'jd')).not.toHaveProperty('@tarojs/components-qa')
    expect(taroQuickappCompile).not.toMatch(/quickapp-container|prepareQuickAppEnvironment|downloadGithubRepoLatestRelease|runQuickApp\(/)
  })
})
