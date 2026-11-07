import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { readFrameworkCatalog, selectFrameworkTarget } from './catalog'
import { createControlledProject, generationInputKey } from './project'
import { taroHarmonyAssets } from './taroHarmony'

const original = 'path.resolve(__dirname, \'..\', \'components\', \'components-harmony\')'
const corrected = 'path.resolve(__dirname, \'components-harmony\')'
const originalSha = 'f68dc24c6dee31089195636229c70ff4bc2778f6af4c520d4167763f92d472cc'

function assetHarness(options: { version?: string, sha?: string, source?: string, filename?: string, cached?: object, error?: Error, changedCache?: object, mode?: string } = {}) {
  const packageFile = path.resolve('controlled-official-platform/package.json')
  const filename = options.filename ?? path.join(path.dirname(packageFile), 'dist/index.js')
  const originalSource = options.source ?? `const path = require('node:path');\nconst unchanged = 'keep all other official bytes';\nmodule.exports = () => ${original};\n`
  const bytes = Buffer.from(originalSource)
  const cache: Record<string, unknown> = options.cached ? { [filename]: options.cached } : {}
  const compiled = vi.fn()
  const report = vi.fn()
  const modulePaths = [path.resolve('controlled-official-platform/node_modules')]
  const nodeModulePaths = vi.fn(() => modulePaths)
  const readFile = vi.fn(() => bytes)
  const environment = { TARO_ENV: 'harmony', TARO_PLATFORM: undefined as string | undefined, NODE_ENV: options.mode ?? 'development', CORPUS_BUILD_MODE: options.mode ?? 'development' }
  const parent = { exports: {} }
  const exported = { officialPlatform: true }
  class PlatformModule {
    static _nodeModulePaths = nodeModulePaths
    filename = ''
    paths: string[] = []
    loaded = false
    exports = exported
    constructor(public id: string, public parent: object) {}
    _compile(source: string, filename: string) {
      compiled(source, filename, this)
      if (options.changedCache) {
        cache[filename] = options.changedCache
      }
      if (options.error) {
        throw options.error
      }
    }
  }
  const requireModule = Object.assign((name: string) => {
    if (name === 'node:assert/strict') {
      return assert
    }
    if (name === 'node:crypto') {
      return { createHash: () => ({ update: () => ({ digest: () => options.sha ?? originalSha }) }) }
    }
    if (name === 'node:fs') {
      return { readFileSync: readFile }
    }
    if (name === 'node:module') {
      return PlatformModule
    }
    if (name === 'node:path') {
      return path
    }
    if (name === 'node:process') {
      return { env: environment }
    }
    if (name === packageFile) {
      return { version: options.version ?? '4.3.2' }
    }
    throw new Error(`Unexpected asset compatibility dependency: ${name}`)
  }, { cache, resolve: (name: string) => name.endsWith('/package.json') ? packageFile : filename })
  return {
    packageFile,
    filename,
    originalSource,
    bytes,
    cache,
    compiled,
    modulePaths,
    nodeModulePaths,
    readFile,
    environment,
    parent,
    exported,
    run: () => runInNewContext(taroHarmonyAssets, { require: requireModule, module: parent, console: { log: report } }),
    report,
  }
}

describe('frozen Harmony official native asset source compatibility', () => {
  it.each(['development', 'production'])('preloads exactly one official module in %s without changing original bytes or other source', (mode) => {
    const harness = assetHarness({ mode })
    const originalBytes = Buffer.from(harness.bytes)
    harness.run()
    expect(harness.readFile).toHaveBeenCalledExactlyOnceWith(harness.filename)
    expect(harness.bytes).toEqual(originalBytes)
    expect(harness.nodeModulePaths).toHaveBeenCalledExactlyOnceWith(path.dirname(harness.filename))
    expect(harness.compiled).toHaveBeenCalledOnce()
    const [source, filename, module] = harness.compiled.mock.calls[0]!
    expect(source).toBe(harness.originalSource.replace(original, corrected))
    expect(filename).toBe(harness.filename)
    expect(module).toMatchObject({ filename, parent: harness.parent, id: filename, paths: harness.modulePaths, loaded: true, exports: harness.exported })
    expect(harness.cache[filename as string]).toBe(module)
    expect(Object.keys(harness.cache)).toEqual([filename])
    expect(harness.parent.exports).toEqual({})
    expect(JSON.parse(harness.report.mock.calls[0]![0] as string)).toEqual({ event: 'template-corpus-harmony-jsui-asset-path-compatibility', version: '4.3.2', sourceSha256: originalSha, protocol: 'official-dist-components-source' })
    expect(() => harness.run()).toThrow('before the CLI')
    expect(harness.compiled).toHaveBeenCalledOnce()
    expect(harness.cache[filename as string]).toBe(module)
  })

  it('rejects version, source hash, package ownership and path-expression drift', () => {
    const cases = [
      { options: { version: '4.3.3' }, message: 'frozen official platform version' },
      { options: { sha: 'changed' }, message: 'official Harmony platform module source changed' },
      { options: { filename: path.resolve('another-package/dist/index.js') }, message: 'verified package' },
      { options: { source: 'module.exports = {}' }, message: 'exactly one known component source path' },
      { options: { source: `${original};${original}` }, message: 'exactly one known component source path' },
    ]
    for (const { options, message } of cases) {
      const harness = assetHarness(options)
      expect(() => harness.run()).toThrow(message)
      expect(harness.compiled).not.toHaveBeenCalled()
      expect(harness.cache).toEqual({})
    }
  })

  it('preserves an existing official cache entry and propagates compilation failures with owned-cache cleanup', () => {
    const cached = { exports: 'already loaded' }
    const existing = assetHarness({ cached })
    expect(() => existing.run()).toThrow('before the CLI')
    expect(existing.cache[existing.filename]).toBe(cached)
    expect(existing.readFile).not.toHaveBeenCalled()
    const error = new Error('official platform initialization failed')
    const failed = assetHarness({ error })
    expect(() => failed.run()).toThrow(error)
    expect(failed.cache).toEqual({})
    const anotherOwner = { exports: 'unrelated owner' }
    const changed = assetHarness({ changedCache: anotherOwner })
    expect(() => changed.run()).toThrow('ownership of the preloaded module cache')
    expect(changed.cache[changed.filename]).toBe(anotherOwner)
  })

  it('rejects another target, another platform and mode drift before reading the package', () => {
    for (const [key, value] of [['TARO_ENV', 'weapp'], ['TARO_PLATFORM', 'mini'], ['CORPUS_BUILD_MODE', 'watch'], ['NODE_ENV', 'production']] as const) {
      const harness = assetHarness()
      harness.environment[key] = value
      expect(() => harness.run()).toThrow()
      expect(harness.readFile).not.toHaveBeenCalled()
      expect(harness.compiled).not.toHaveBeenCalled()
    }
  })

  it('includes the preloader bytes in generation identity and enables it only for the Harmony CLI child', async () => {
    const catalog = await readFrameworkCatalog()
    const selected = selectFrameworkTarget(catalog, 'taro', '4.3.2', 'harmony-jsui')
    const project = createControlledProject(selected.release, selected.target)
    expect(project.files['harmony-jsui-assets.cjs']).toBe(taroHarmonyAssets)
    const identity = { repository: 'example/templates', commit: 'a'.repeat(40), licenseId: 'confirmed' }
    expect(generationInputKey(identity, project)).not.toBe(generationInputKey(identity, { ...project, files: { ...project.files, 'harmony-jsui-assets.cjs': `${taroHarmonyAssets}\n` } }))
    const spawn = vi.fn(() => ({ status: 0 }))
    const environment = {}
    const process = { argv: ['node', 'compile.cjs', 'development', 'harmony', 'out/development'], env: environment, execPath: 'controlled-node', exitCode: 0 }
    const cliPackage = path.resolve('official-cli/package.json')
    const fs = { mkdirSync: vi.fn(), copyFileSync: vi.fn(), readFileSync: () => JSON.stringify({ module: { js: [{ name: 'default', pages: ['pages/index'] }] } }) }
    const requireModule = Object.assign((name: string) => {
      if (name === 'path') {
        return path
      }
      if (name === 'fs') {
        return fs
      }
      if (name === 'child_process') {
        return { spawnSync: spawn }
      }
      throw new Error(`Unexpected compile dependency: ${name}`)
    }, { resolve: () => cliPackage })
    runInNewContext(project.files['compile.cjs']!, { require: requireModule, process })
    expect(spawn).toHaveBeenCalledExactlyOnceWith('controlled-node', ['--require', path.resolve('harmony-jsui-assets.cjs'), path.join(path.dirname(cliPackage), 'bin/taro'), 'build', '--type', 'harmony'], { stdio: 'inherit', env: environment })
    const weapp = selectFrameworkTarget(catalog, 'taro', '4.3.2', 'weapp')
    const normal = createControlledProject(weapp.release, weapp.target)
    expect(normal.files).not.toHaveProperty('harmony-jsui-assets.cjs')
    expect(normal.files['compile.cjs']).not.toContain('--require')
  })
})
