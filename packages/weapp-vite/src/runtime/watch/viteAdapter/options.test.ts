import type { Stats } from 'node:fs'
import type { ResolvedConfig } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { collectViteAdapterTargets, resolveViteAdapterOptions, usesNativeViteWatcher } from './options'

afterEach(() => vi.unstubAllEnvs())

describe('Vite adapter public options', () => {
  it('anchors relative strings to cwd and includes literal descendants', () => {
    const { backend } = resolveViteAdapterOptions({}, { cwd: '/project', ignored: ['cache', '*.generated.ts'] })
    const ignored = backend.ignored as (file: string) => boolean
    expect(ignored('/project/cache')).toBe(true)
    expect(ignored('/project/cache/nested/file.ts')).toBe(true)
    expect(ignored('/project/output.generated.ts')).toBe(true)
    expect(ignored('/another/output.generated.ts')).toBe(false)
  })

  it('keeps literal matching relative without cwd and expands non-glob descendants', () => {
    const { backend } = resolveViteAdapterOptions({}, { ignored: ['cache', '/project/output'] })
    const ignored = backend.ignored as (file: string) => boolean
    expect(ignored('cache/file.ts')).toBe(true)
    expect(ignored('/project/cache/file.ts')).toBe(false)
    expect(ignored('/project/output/nested/file.ts')).toBe(true)
  })

  it('normalizes strings before anymatch decides which entries are negative', () => {
    const patterns = ['**/*.generated.ts', '!**/keep.generated.ts']
    const withoutCwd = resolveViteAdapterOptions({}, { ignored: patterns }).backend.ignored as (file: string) => boolean
    const withCwd = resolveViteAdapterOptions({}, { cwd: '/project', ignored: patterns }).backend.ignored as (file: string) => boolean
    expect(withoutCwd('/project/keep.generated.ts')).toBe(false)
    expect(withCwd('/project/keep.generated.ts')).toBe(true)
  })

  it('uses strict is-glob literal expansion rather than picomatch scan classification', () => {
    const { backend } = resolveViteAdapterOptions({}, { ignored: ['/project/file?.js', '/project/{}'] })
    const ignored = backend.ignored as (file: string) => boolean
    expect(ignored('/project/fileA.js/nested')).toBe(true)
    expect(ignored('/project/{}/nested')).toBe(true)
  })

  it('preserves anymatch callback path and stats without resolving cwd or dot segments', () => {
    const matcher = vi.fn(() => false)
    const { backend } = resolveViteAdapterOptions({}, { cwd: '/project', ignored: matcher })
    const ignored = backend.ignored as (file: string, stats?: Stats) => boolean
    const stats = {} as Stats
    ignored('relative//nested/../input.ts/', stats)
    expect(matcher).toHaveBeenCalledExactlyOnceWith('relative/nested/../input.ts/', stats)
  })

  it('retains native RegExp test state across calls', () => {
    const pattern = /\.skip$/g
    const { backend } = resolveViteAdapterOptions({}, { ignored: pattern })
    const ignored = backend.ignored as (file: string) => boolean
    expect(ignored('/project/one.skip')).toBe(true)
    expect(ignored('/project/one.skip')).toBe(false)
    expect(ignored('/project/one.skip')).toBe(true)
  })

  it('preserves Vite glob ignored rules and explicitly maps watcher behavior', () => {
    const defaults = { disableGlobbing: true, ignoreInitial: true, ignored: ['**/node_modules/**'] }
    const requested = {
      ignored: ['**/*.generated.ts', '!**/keep.generated.ts'],
      depth: 2,
      cwd: '/project',
      followSymlinks: false,
      usePolling: true,
      interval: 23,
      atomic: 12,
      awaitWriteFinish: { stabilityThreshold: 31, pollInterval: 7 },
    }
    const result = resolveViteAdapterOptions(defaults, requested)
    expect(result.backend).toMatchObject({ ...requested, persistent: false, ignored: expect.any(Function) })
    const ignored = result.backend.ignored as (file: string) => boolean
    expect(ignored('/project/node_modules/package/a.js')).toBe(true)
    expect(ignored('/project/a.generated.ts')).toBe(true)
    expect(ignored('/project/keep.generated.ts')).toBe(true)
    expect(ignored('/project/a.ts')).toBe(false)
  })

  it('retains native watching for explicit options requiring the original backend', () => {
    vi.stubEnv('CHOKIDAR_USEPOLLING', undefined)
    expect(usesNativeViteWatcher({ disableGlobbing: false })).toBe(true)
    expect(usesNativeViteWatcher({ followSymlinks: false, usePolling: true })).toBe(true)
    expect(usesNativeViteWatcher({ followSymlinks: true })).toBe(false)
    expect(usesNativeViteWatcher({ useFsEvents: true, usePolling: false })).toBe(true)
    expect(usesNativeViteWatcher({ useFsEvents: true, usePolling: true })).toBe(false)
    vi.stubEnv('CHOKIDAR_USEPOLLING', 'true')
    expect(usesNativeViteWatcher({ useFsEvents: true })).toBe(false)
    vi.stubEnv('CHOKIDAR_USEPOLLING', 'false')
    expect(usesNativeViteWatcher({ useFsEvents: true, usePolling: true })).toBe(true)
  })

  it('keeps absent env and external public targets, including bundled dev configuration watching', () => {
    const config = {
      root: '/project',
      mode: 'development',
      configFileDependencies: ['/config/shared.ts'],
      envDir: '/external-env',
      publicDir: '/external-public',
      experimental: { bundledDev: false },
    } as ResolvedConfig
    expect(collectViteAdapterTargets(config)).toEqual([
      '/project',
      '/config/shared.ts',
      '/external-env/.env',
      '/external-env/.env.local',
      '/external-env/.env.development',
      '/external-env/.env.development.local',
      '/external-public',
    ])
    config.experimental.bundledDev = true
    expect(collectViteAdapterTargets(config)).not.toContain('/project')
    config.envDir = false
    config.publicDir = ''
    expect(collectViteAdapterTargets(config)).toEqual(['/config/shared.ts'])
  })
})
