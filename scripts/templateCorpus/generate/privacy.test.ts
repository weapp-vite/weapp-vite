import type { FrameworkRelease, FrameworkTarget } from './types'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { createMpxProject } from './mpx'
import { createTaroProject } from './taro'

function target(name: string): FrameworkTarget {
  return { target: name, platform: 'weapp', profileId: 'weapp-legacy', extensions: ['.wxml'], support: 'candidate', evidence: 'controlled compiler configuration' }
}

function release(framework: FrameworkRelease['framework'], version: string): FrameworkRelease {
  return { framework, version, compiler: 'pinned official compiler', targets: [] }
}

function mpxConfiguration(mode: 'development' | 'production', version: string) {
  const project = createMpxProject(release('mpx', version), target('wx'))
  let received: Record<string, unknown> | undefined
  const process = { argv: ['node', 'compile.cjs', mode, 'wx', `out/${mode}`], env: {} as Record<string, string>, exitCode: 0 }
  const requireModule = (name: string) => {
    if (name === 'path') {
      return path
    }
    if (name === '@mpxjs/webpack-plugin') {
      return class {
        static loader() { return 'official-mpx-loader' }
        static wxmlLoader() { return 'official-template-loader' }
        static wxssLoader() { return 'official-style-loader' }
        static wxsPreLoader() { return 'official-script-loader' }
      }
    }
    if (name === 'webpack') {
      return (config: Record<string, unknown>) => {
        received = config
        return {
          run(callback: (error: unknown, stats: object) => void) { callback(null, { hasErrors: () => false, toString: () => '' }) },
          close(callback: (error?: unknown) => void) { callback() },
        }
      }
    }
    throw new Error(`Unexpected compiler dependency: ${name}`)
  }
  runInNewContext(project.files['compile.cjs']!, { require: requireModule, process, console: { log: vi.fn(), error: vi.fn() } })
  return { received, process }
}

interface MiniConfiguration {
  webpackChain?: (chain: {
    devtool: (value: boolean) => void
    output: { pathinfo: (value: boolean) => void }
    optimization: { set: (key: string, value: unknown) => unknown }
  }) => void
  postcss: object
}

function taroConfiguration(name: string) {
  const project = createTaroProject(release('taro', '2.2.22'), target(name))
  const module = { exports: undefined as unknown as () => { mini: MiniConfiguration } }
  runInNewContext(project.files['config/index.js']!, { module, process: { env: { CORPUS_OUTPUT: 'out/development' } } })
  return module.exports()
}

describe('redistributable development compiler evidence', () => {
  it('keeps Harmony Babel runtime imports independent of the controlled workspace path', () => {
    const project = createTaroProject(release('taro', '4.3.2'), target('harmony-jsui'))
    const module = { exports: undefined as unknown }
    runInNewContext(project.files['babel.config.js']!, { module })
    expect(module.exports).toEqual({ presets: [['taro', { framework: 'react', ts: true, absoluteRuntime: false }]] })
    const weapp = createTaroProject(release('taro', '4.3.2'), target('weapp'))
    const unchanged = { exports: undefined as unknown }
    runInNewContext(weapp.files['babel.config.js']!, { module: unchanged })
    expect(unchanged.exports).toEqual({ presets: [['taro', { framework: 'react', ts: true }]] })
  })

  it('resolves relative Harmony helpers from the frozen preset dependency instead of an ancestor workspace', () => {
    const project = createTaroProject(release('taro', '4.3.2'), target('harmony-jsui'))
    const preset = path.resolve('controlled/node_modules/babel-preset-taro/package.json')
    const runtime = path.resolve('controlled/node_modules/.pnpm/runtime/node_modules/@babel/runtime/package.json')
    const presetRequire = { resolve: vi.fn(() => runtime) }
    const createRequire = vi.fn(() => presetRequire)
    const requireModule = Object.assign((name: string) => {
      if (name === 'node:module') {
        return { createRequire }
      }
      if (name === 'path') {
        return path
      }
      throw new Error(`Unexpected configuration dependency: ${name}`)
    }, { resolve: vi.fn((name: string) => name === 'babel-preset-taro/package.json' ? preset : name) })
    const module = { exports: undefined as unknown as { harmony: { webpackChain: (chain: { resolve: { alias: Map<string, string> } }) => void }, mini: { webpackChain?: unknown } } }
    runInNewContext(project.files['config/index.js']!, { module, require: requireModule, process: { env: { CORPUS_OUTPUT: 'out/development' } } })
    const alias = new Map<string, string>()
    module.exports.harmony.webpackChain({ resolve: { alias } })
    expect(createRequire).toHaveBeenCalledExactlyOnceWith(preset)
    expect(presetRequire.resolve).toHaveBeenCalledExactlyOnceWith('@babel/runtime/package.json')
    expect(alias.get('@babel/runtime')).toBe(path.dirname(runtime))
    expect(module.exports.mini.webpackChain).toBeUndefined()
  })

  it.each(['2.11.2', '2.8.64'])('disables MPX eval source URLs while keeping both real modes at %s', (version) => {
    for (const mode of ['development', 'production'] as const) {
      const result = mpxConfiguration(mode, version)
      expect(result.process.env.NODE_ENV).toBe(mode)
      expect(result.received).toMatchObject({ mode, devtool: false })
      expect(result.process.exitCode).toBe(0)
    }
  })

  it('configures QuickApp through the official mini webpack hook without changing other Taro 2 targets', () => {
    const config = taroConfiguration('quickapp')
    const devtool = vi.fn()
    const pathinfo = vi.fn()
    const optimization = new Map<string, unknown>()
    config.mini.webpackChain!({ devtool, output: { pathinfo }, optimization })
    expect(devtool).toHaveBeenCalledWith(false)
    expect(pathinfo).toHaveBeenCalledWith(false)
    expect(optimization.get('namedModules')).toBe(false)
    expect(optimization.get('moduleIds')).toBe('hashed')
    expect(config.mini.postcss).toMatchObject({ pxtransform: { enable: false } })
    expect(taroConfiguration('weapp').mini.webpackChain).toBeUndefined()
  })
})
