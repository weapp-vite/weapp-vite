import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { readFrameworkCatalog, selectFrameworkTarget } from './catalog'
import { createControlledProject, generationInputKey } from './project'
import { taroHarmonyPlugin } from './taroHarmony'

interface RunnerOptions {
  platform: string
  framework: string
  compiler: { type: string, runner?: string, prebundle?: object }
  mode?: string
  isWatch?: boolean
}

interface PlatformHook {
  name: string
  stage: number
  fn: (data: { config: RunnerOptions }) => void
}

function pluginHarness(version = '4.3.2') {
  let modify: (data: { opts: RunnerOptions }) => void
  let start: () => void
  let platform: PlatformHook
  const environment = { TARO_ENV: 'harmony', NODE_ENV: 'development', CORPUS_BUILD_MODE: 'development' }
  const initialConfig = { compiler: { type: 'webpack5', prebundle: { include: ['react'] } } }
  const context = {
    initialConfig,
    runOpts: { config: undefined as RunnerOptions | undefined },
    modifyRunnerOpts(fn: typeof modify) { modify = fn },
    onBuildStart(fn: typeof start) { start = fn },
    register(hook: PlatformHook) { platform = hook },
  }
  const resolve = vi.fn(() => 'controlled-harmony-runner.cjs')
  const requireModule = Object.assign((name: string) => {
    if (name === 'node:assert/strict') {
      return assert
    }
    if (name === 'node:process') {
      return { env: environment }
    }
    if (name.endsWith('/package.json')) {
      return { version }
    }
    throw new Error(`Unexpected compiler dependency: ${name}`)
  }, { resolve })
  const module = { exports: undefined as unknown as (ctx: typeof context) => void }
  runInNewContext(taroHarmonyPlugin, { require: requireModule, module })
  module.exports(context)
  function options(): RunnerOptions {
    return { platform: 'harmony', framework: 'react', compiler: initialConfig.compiler }
  }
  return {
    context,
    environment,
    options,
    resolve,
    capture(opts: RunnerOptions) {
      context.runOpts.config = opts
      modify({ opts })
    },
    start: () => start(),
    platform: () => platform,
  }
}

describe('frozen Taro Harmony JSUI plugin lifecycle', () => {
  it.each(['development', 'production'])('keeps schema inputs intact and selects %s before the official platform handler', (mode) => {
    const harness = pluginHarness()
    harness.environment.NODE_ENV = mode
    harness.environment.CORPUS_BUILD_MODE = mode
    const opts = harness.options()
    const validatedCompiler = opts.compiler
    harness.capture(opts)
    // 官方 CLI 在 modifyRunnerOpts 之后校验 initialConfig，runner 此时尚未安装。
    expect(opts.compiler).toBe(harness.context.initialConfig.compiler)
    expect(opts.compiler).not.toHaveProperty('runner')
    harness.start()
    expect(harness.context.initialConfig.compiler).toBe(validatedCompiler)
    expect(validatedCompiler).not.toHaveProperty('runner')
    expect(opts.compiler).toEqual({ type: 'webpack5', prebundle: { include: ['react'] }, runner: 'controlled-harmony-runner.cjs' })
    expect(opts.compiler).not.toBe(validatedCompiler)
    const platformConfig = { ...opts, mode: 'production', isWatch: false }
    const original = vi.fn(({ config }: { config: RunnerOptions }) => {
      expect(config.mode).toBe(mode)
      expect(config.isWatch).toBe(false)
    })
    const hook = harness.platform()
    expect(hook).toMatchObject({ name: 'harmony', stage: -1 })
    for (const entry of [hook, { stage: 0, fn: original }].sort((a, b) => a.stage - b.stage)) {
      entry.fn({ config: platformConfig })
    }
    expect(original).toHaveBeenCalledOnce()
    expect(harness.resolve).toHaveBeenCalledWith('./harmony-jsui-runner.cjs')
  })

  it('consumes each captured run once and never reuses an earlier configuration', () => {
    const harness = pluginHarness()
    const first = harness.options()
    harness.capture(first)
    harness.start()
    expect(() => harness.start()).toThrow('current captured configuration only once')
    expect(() => harness.capture(first)).toThrow('captured once per build')
    const second = harness.options()
    harness.capture(second)
    expect(() => harness.capture(harness.options())).toThrow('captured once per build')
    expect(() => harness.platform().fn({ config: { ...first, isWatch: false } })).toThrow('installed for this build')
    expect(() => harness.start()).toThrow('current captured configuration only once')
    expect(second.compiler).not.toHaveProperty('runner')
    const current = harness.options()
    harness.capture(current)
    harness.start()
    expect(() => harness.platform().fn({ config: { ...first, isWatch: false } })).toThrow('installed for this build')
    expect(() => harness.platform().fn({ config: { ...current, isWatch: false } })).not.toThrow()
  })

  it('rejects a changed run reference and permits a fresh capture after the failure', () => {
    const harness = pluginHarness()
    const first = harness.options()
    harness.capture(first)
    harness.context.runOpts.config = harness.options()
    expect(() => harness.start()).toThrow('current captured configuration only once')
    expect(first.compiler).not.toHaveProperty('runner')
    const current = harness.options()
    harness.capture(current)
    expect(() => harness.start()).not.toThrow()
  })

  it('rejects toolchain, target, compiler, watch and mode drift', () => {
    expect(() => pluginHarness('4.3.3')).toThrow('frozen Taro 4.3.2')
    const target = pluginHarness()
    expect(() => target.capture({ ...target.options(), platform: 'weapp' })).toThrow('only accepts the Harmony target')
    const compiler = pluginHarness()
    expect(() => compiler.capture({ ...compiler.options(), compiler: { type: 'webpack5', runner: 'another-runner' } })).toThrow('validated compiler configuration')
    const watching = pluginHarness()
    const opts = watching.options()
    watching.capture(opts)
    watching.start()
    expect(() => watching.platform().fn({ config: { ...opts, isWatch: true } })).toThrow('without a persistent watcher')
    const mode = pluginHarness()
    mode.environment.NODE_ENV = 'production'
    mode.capture(mode.options())
    expect(() => mode.start()).toThrow('NODE_ENV must match')
  })

  it('includes the plugin source and explicit mode handoff in the generated identity', async () => {
    const catalog = await readFrameworkCatalog()
    const selected = selectFrameworkTarget(catalog, 'taro', '4.3.2', 'harmony-jsui')
    const project = createControlledProject(selected.release, selected.target)
    expect(project.files['harmony-jsui-plugin.cjs']).toBe(taroHarmonyPlugin)
    expect(project.files['compile.cjs']).toContain('process.env.CORPUS_BUILD_MODE = process.argv[2]')
    const identity = { repository: 'example/templates', commit: 'a'.repeat(40), licenseId: 'confirmed' }
    const changed = { ...project, files: { ...project.files, 'harmony-jsui-plugin.cjs': `${taroHarmonyPlugin}\n` } }
    expect(generationInputKey(identity, project)).not.toBe(generationInputKey(identity, changed))
  })
})
