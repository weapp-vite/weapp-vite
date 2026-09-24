import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveSmokeCache } from '../../../scripts/createWeappViteSmoke/cache.mjs'
import { createPnpmProfileConfig, createRegistryEnvironment, reportError, resolveRegistryProfiles } from '../../../scripts/createWeappViteSmoke/registry.mjs'
import { mergeSmokeReports, renderSmokeReport } from '../../../scripts/merge-create-weapp-vite-smoke-reports.mjs'

describe('scaffold smoke cache ownership', () => {
  it('keeps the default cold cache beneath the run temporary directory', () => {
    const tmpRoot = path.join(os.tmpdir(), 'scaffold-smoke-cold')
    for (const configuredRoot of [undefined, '', '   ']) {
      expect(resolveSmokeCache(tmpRoot, configuredRoot)).toEqual({ cacheRoot: path.join(tmpRoot, 'cache'), cacheMode: 'cold' })
    }
  })

  it('resolves an explicitly configured cache directory as reused', () => {
    const tmpRoot = path.join(os.tmpdir(), 'scaffold-smoke-persistent')
    expect(resolveSmokeCache(tmpRoot, ' smoke-cache ')).toEqual({ cacheRoot: path.resolve('smoke-cache'), cacheMode: 'reused' })
  })

  it('shares each isolated registry cache across environments and explicit pnpm options', () => {
    const { cacheRoot } = resolveSmokeCache(path.join(os.tmpdir(), 'smoke-run'), path.join(os.tmpdir(), 'smoke-cache'))
    for (const profile of resolveRegistryProfiles()) {
      const profileCacheRoot = path.join(cacheRoot, profile.name)
      const env = createRegistryEnvironment(profile, profileCacheRoot, {})
      const pnpm = createPnpmProfileConfig(profile, profileCacheRoot)
      expect(env.npm_config_cache).toBe(path.join(profileCacheRoot, 'npm'))
      expect(env.npm_config_store_dir).toBe(pnpm['store-dir'])
      expect(env.npm_config_cache_dir).toBe(pnpm['cache-dir'])
      expect(env.XDG_CACHE_HOME).toBe(path.join(profileCacheRoot, 'xdg'))
      expect(pnpm['state-dir']).toBe(path.join(profileCacheRoot, 'pnpm-state'))
    }
  })

  it('preserves external cache content when the run temporary directory is cleaned', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'smoke-cache-ownership-'))
    try {
      const tmpRoot = path.join(root, 'run')
      const { cacheRoot } = resolveSmokeCache(tmpRoot, path.join(root, 'retained-cache'))
      const cachedFile = path.join(cacheRoot, 'npmjs', 'cached-package')
      await fs.mkdir(tmpRoot, { recursive: true })
      await fs.mkdir(path.dirname(cachedFile), { recursive: true })
      await fs.writeFile(cachedFile, 'cached')
      await fs.rm(tmpRoot, { recursive: true, force: true })
      expect(await fs.readFile(cachedFile, 'utf8')).toBe('cached')
      expect(reportError(new Error(`cache file: ${cachedFile}`), [cacheRoot, tmpRoot])).toBe(`cache file: ${path.join('<temporary>', 'npmjs', 'cached-package')}`)
    }
    finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('retains cache mode in merged rows and rendered reports without reporting cache paths', () => {
    const reports = ['cold', 'reused'].map(cacheMode => ({
      os: 'linux',
      nodeVersion: '24',
      cacheMode,
      results: [{ registryProfile: 'npmjs', scenario: 'pnpm', template: 'default' }],
      failures: [{ registryProfile: 'npmmirror', stage: 'install', kind: 'network', error: 'ETIMEDOUT' }],
      registries: [{ name: 'npmjs' }],
      summary: { status: 'environment-limited' },
    }))
    const merged = mergeSmokeReports(reports)
    for (const rows of [merged.rows, merged.failures, merged.registries, merged.summaries]) {
      expect(rows.map((row: { cacheMode: string }) => row.cacheMode)).toEqual(['cold', 'reused'])
    }
    const markdown = renderSmokeReport(merged)
    expect(markdown).toContain('Cache cold')
    expect(markdown).toContain('Cache reused')
    expect(markdown).toContain('| Cache |')
    expect(mergeSmokeReports([{}]).summaries[0].cacheMode).toBe('unknown')
  })
})
