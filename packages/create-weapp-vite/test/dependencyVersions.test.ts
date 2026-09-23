import type { PackageJson } from 'pkg-types'
import type { RegistryOptions } from '../src/npm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveDependencyVersions, validateDependencyVersionStrategy } from '../src/dependencyVersions'
import { findCompatibleVersion } from '../src/dependencyVersions/compatible'
import { getPackageVersionsFromNpm } from '../src/npm'
import { logger } from '../vitest.setup'

vi.mock('../../weapp-vite/package.json', () => ({ version: '7.1.4' }))
vi.mock('../../../packages-runtime/wevu/package.json', () => ({ version: '7.1.4' }))
vi.mock('../../dashboard/package.json', () => ({ version: '7.1.4' }))
vi.mock('../../../packages-runtime/react/package.json', () => ({ version: '0.2.6' }))
vi.mock('../../eslint/package.json', () => ({ version: '0.2.8' }))
vi.mock('../src/npm', async importOriginal => ({
  ...await importOriginal<typeof import('../src/npm')>(),
  getPackageVersionsFromNpm: vi.fn(),
}))

const network: RegistryOptions = { registry: 'https://registry.example.test/', strictSSL: true }

const fetchVersions = vi.mocked(getPackageVersionsFromNpm)

function createPackage(): PackageJson {
  return {
    dependencies: { 'wevu': 'workspace:*', '@weapp-vite/react': 'workspace:*' },
    devDependencies: { 'weapp-vite': 'workspace:*', '@weapp-vite/eslint': 'workspace:*' },
    optionalDependencies: { '@weapp-vite/dashboard': 'workspace:*' },
  }
}

function expectBundled(pkg: PackageJson) {
  expect(pkg.dependencies).toEqual({ 'wevu': '^7.1.4', '@weapp-vite/react': '^0.2.6' })
  expect(pkg.devDependencies).toEqual({ 'weapp-vite': '^7.1.4', '@weapp-vite/eslint': '^0.2.8' })
  expect(pkg.optionalDependencies).toEqual({ '@weapp-vite/dashboard': '^7.1.4' })
}

describe('dependency version resolution', () => {
  beforeEach(() => {
    fetchVersions.mockReset().mockResolvedValue(['7.1.4', '7.2.0'])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('updates the fixed core group together while retaining independent package versions', async () => {
    const pkg = createPackage()
    fetchVersions.mockResolvedValue(['7.1.3', '7.1.4', '7.2.0', '7.10.0', '8.0.0', '7.11.0-beta.1', 'invalid'])
    await resolveDependencyVersions(pkg, 'compatible', network)
    expect(pkg.dependencies).toEqual({ 'wevu': '^7.10.0', '@weapp-vite/react': '^0.2.6' })
    expect(pkg.devDependencies).toEqual({ 'weapp-vite': '^7.10.0', '@weapp-vite/eslint': '^0.2.8' })
    expect(pkg.optionalDependencies).toEqual({ '@weapp-vite/dashboard': '^7.10.0' })
    expect(fetchVersions.mock.calls.map(([name]) => name)).toEqual(['weapp-vite', 'wevu', '@weapp-vite/dashboard'])
    expect(new Set(fetchVersions.mock.calls.map(([, signal]) => signal)).size).toBe(1)
  })

  it('uses the highest common version during a partially published fixed-group release', async () => {
    const pkg = createPackage()
    fetchVersions.mockImplementation(async name => name === '@weapp-vite/dashboard' ? ['7.1.4', '7.2.0'] : ['7.1.4', '7.2.0', '7.2.1'])
    await resolveDependencyVersions(pkg, 'compatible', network)
    expect(pkg.devDependencies?.['weapp-vite']).toBe('^7.2.0')
    expect(pkg.dependencies?.wevu).toBe('^7.2.0')
    expect(pkg.optionalDependencies?.['@weapp-vite/dashboard']).toBe('^7.2.0')
  })

  it('only queries core packages actually present in a native template', async () => {
    const pkg = { devDependencies: { 'weapp-vite': 'workspace:*' } }
    await resolveDependencyVersions(pkg, 'compatible', network)
    expect(pkg.devDependencies['weapp-vite']).toBe('^7.2.0')
    expect(fetchVersions).toHaveBeenCalledExactlyOnceWith('weapp-vite', expect.any(AbortSignal), network)
    expect(Object.keys(pkg)).toEqual(['devDependencies'])
  })

  it('updates every existing dependency field without introducing dependencies', async () => {
    const pkg: PackageJson = {
      dependencies: { 'weapp-vite': 'workspace:*', 'unrelated': '~1.2.3' },
      devDependencies: { 'weapp-vite': 'workspace:*' },
      peerDependencies: { 'weapp-vite': 'workspace:*' },
      optionalDependencies: { 'weapp-vite': 'workspace:*' },
    }
    await resolveDependencyVersions(pkg, 'compatible', network)
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const) {
      expect(pkg[field]?.['weapp-vite']).toBe('^7.2.0')
      expect(pkg[field]?.wevu).toBeUndefined()
    }
    expect(pkg.dependencies?.unrelated).toBe('~1.2.3')
  })

  it('defaults to bundled versions without performing any network requests', async () => {
    const pkg = createPackage()
    await resolveDependencyVersions(pkg)
    expectBundled(pkg)
    expect(fetchVersions).not.toHaveBeenCalled()
  })

  it('does not query npm when the template uses no core packages', async () => {
    const pkg = { dependencies: { '@weapp-vite/react': 'workspace:*' } }
    await resolveDependencyVersions(pkg, 'compatible', network)
    expect(pkg.dependencies['@weapp-vite/react']).toBe('^0.2.6')
    expect(fetchVersions).not.toHaveBeenCalled()
  })

  it('preserves the whole bundled group and cancels other requests on one registry failure', async () => {
    const pkg = createPackage()
    fetchVersions.mockImplementation(async (name) => {
      if (name === 'wevu') {
        throw new Error('HTTP 503')
      }
      return ['7.2.0']
    })
    await resolveDependencyVersions(pkg, 'compatible', network)
    expectBundled(pkg)
    expect(fetchVersions.mock.calls.every(([, signal]) => signal?.aborted)).toBe(true)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('weapp-vite@7.1.4、wevu@7.1.4、@weapp-vite/dashboard@7.1.4'))
  })

  it('falls back as a group when no common stable version exists', async () => {
    const pkg = createPackage()
    fetchVersions.mockImplementation(async name => name === 'wevu' ? ['7.2.0'] : ['7.1.4'])
    await resolveDependencyVersions(pkg, 'compatible', network)
    expectBundled(pkg)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('没有共同版本'))
  })

  it('does not downgrade or select prereleases when the registry has no compatible version', async () => {
    const pkg = createPackage()
    fetchVersions.mockResolvedValue(['7.1.3', '8.0.0', '7.2.0-beta.1', 'latest'])
    await resolveDependencyVersions(pkg, 'compatible', network)
    expectBundled(pkg)
  })

  it('bounds the primary registry batch by four seconds', async () => {
    vi.useFakeTimers()
    const pkg = createPackage()
    fetchVersions.mockImplementation(() => new Promise(() => {}))
    const resolution = resolveDependencyVersions(pkg, 'compatible', network)
    expect(fetchVersions).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(4_000)
    await resolution
    expectBundled(pkg)
    expect(fetchVersions.mock.calls.every(([, signal]) => signal?.aborted)).toBe(true)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('总上限为 5 秒'))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears the group deadline after a successful resolution', async () => {
    vi.useFakeTimers()
    await resolveDependencyVersions(createPackage(), 'compatible', network)
    expect(vi.getTimerCount()).toBe(0)
    expect(fetchVersions.mock.calls.every(([, signal]) => !signal?.aborted)).toBe(true)
  })

  it('shares the core deadline with Tailwind and ignores late responses after fallback', async () => {
    vi.useFakeTimers()
    const pkg = { ...createPackage(), devDependencies: { 'weapp-vite': 'workspace:*', 'weapp-tailwindcss': '^5.5.8' } }
    let finishTailwind: (versions: string[]) => void = () => {}
    fetchVersions.mockImplementation(async name => name === 'weapp-tailwindcss'
      ? new Promise<string[]>((resolve) => { finishTailwind = resolve })
      : ['7.2.0'])
    const resolution = resolveDependencyVersions(pkg, 'compatible', network)
    await vi.advanceTimersByTimeAsync(4_000)
    expect(await resolution).toEqual({ strategy: 'bundled' })
    expect(pkg.devDependencies['weapp-vite']).toBe('^7.1.4')
    expect(pkg.devDependencies['weapp-tailwindcss']).toBe('^5.5.8')
    finishTailwind(['5.6.0'])
    await Promise.resolve()
    expect(pkg.devDependencies['weapp-vite']).toBe('^7.1.4')
    expect(new Set(fetchVersions.mock.calls.map(([, signal]) => signal)).size).toBe(1)
  })

  it.each(['^5.5.8', '5.5.8', '~5.5.8', '>=5.5.8 <5.6.0'])('updates Tailwind within the template constraint %s', async (spec) => {
    const pkg = { devDependencies: { 'weapp-vite': 'workspace:*', 'weapp-tailwindcss': spec } }
    fetchVersions.mockImplementation(async name => name === 'weapp-tailwindcss' ? ['5.5.8', '5.6.0', '6.0.0'] : ['7.2.0'])
    await resolveDependencyVersions(pkg, 'compatible', network)
    expect(pkg.devDependencies['weapp-tailwindcss']).toBe(spec === '^5.5.8' ? '^5.6.0' : spec)
    expect(fetchVersions.mock.calls.every(([, , options]) => options === network)).toBe(true)
  })

  it('keeps the bundled group when the installation registry lacks compatible Tailwind versions', async () => {
    const pkg = { devDependencies: { 'weapp-vite': 'workspace:*', 'weapp-tailwindcss': '^5.5.8' } }
    fetchVersions.mockImplementation(async name => name === 'weapp-tailwindcss' ? ['5.5.7', '6.0.0'] : ['7.2.0'])
    expect(await resolveDependencyVersions(pkg, 'compatible', network)).toEqual({ strategy: 'bundled' })
    expect(pkg.devDependencies).toEqual({ 'weapp-vite': '^7.1.4', 'weapp-tailwindcss': '^5.5.8' })
  })

  it('never uses a backup registry version in the current registry project', async () => {
    const options = { ...network, 'registry': 'https://registry.npmmirror.com/', '//registry.npmmirror.com/:_authToken': 'private-token' }
    fetchVersions.mockImplementation(async (_name, _signal, requestOptions) => {
      if (requestOptions?.registry === options.registry) {
        throw new Error('mirror unavailable')
      }
      expect(requestOptions).not.toHaveProperty('//registry.npmmirror.com/:_authToken')
      return ['7.3.0']
    })
    const pkg = createPackage()
    expect(await resolveDependencyVersions(pkg, 'compatible', options)).toEqual({ strategy: 'bundled' })
    expectBundled(pkg)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('备用源'))
  })

  it('bounds a stalled primary and backup registry to five seconds total', async () => {
    vi.useFakeTimers()
    fetchVersions.mockImplementation(() => new Promise(() => {}))
    const result = resolveDependencyVersions(createPackage(), 'compatible', { ...network, registry: 'https://registry.npmjs.org/' })
    await vi.advanceTimersByTimeAsync(5_000)
    expect(await result).toEqual({ strategy: 'bundled' })
    expect(vi.getTimerCount()).toBe(0)
    expect(fetchVersions.mock.calls.every(([, signal]) => signal?.aborted)).toBe(true)
  })

  it('rejects invalid strategies before touching dependencies or querying npm', async () => {
    const pkg = createPackage()
    const before = structuredClone(pkg)
    // @ts-expect-error 验证来自 JavaScript 调用方的非法选项。
    await expect(resolveDependencyVersions(pkg, 'latest')).rejects.toThrow('仅支持 compatible 或 bundled')
    expect(pkg).toEqual(before)
    expect(fetchVersions).not.toHaveBeenCalled()
  })

  it.each([undefined, null, '', 'latest', 1])('rejects invalid strategy %j', (strategy) => {
    expect(() => validateDependencyVersionStrategy(strategy)).toThrow('无效的依赖版本策略')
  })
})

describe('compatible version selection', () => {
  it.each([
    ['0.2.6', ['0.2.6', '0.2.9', '0.3.0', '1.0.0'], '0.2.9'],
    ['0.0.6', ['0.0.5', '0.0.6', '0.0.7'], '0.0.6'],
    ['7.1.4', ['7.1.4', '7.2.0', '8.0.0'], '7.2.0'],
  ])('follows semver caret compatibility for baseline %s', (version, versions, expected) => {
    expect(findCompatibleVersion([{ version, versions }])).toBe(expected)
  })

  it('satisfies every individual baseline without downgrading any group member', () => {
    expect(findCompatibleVersion([
      { version: '7.1.4', versions: ['7.1.4', '7.2.0'] },
      { version: '7.2.1', versions: ['7.1.4', '7.2.0', '7.2.1'] },
    ])).toBeUndefined()
  })

  it('preserves prerelease baselines instead of moving them to stable releases', () => {
    expect(findCompatibleVersion([{ version: '7.2.0-beta.1', versions: ['7.2.0', '7.3.0'] }])).toBeUndefined()
  })

  it('handles empty and invalid baseline candidates', () => {
    expect(findCompatibleVersion([])).toBeUndefined()
    expect(findCompatibleVersion([{ version: 'invalid', versions: ['7.2.0'] }])).toBeUndefined()
    expect(findCompatibleVersion([{ version: '7.1.4', versions: [] }])).toBeUndefined()
  })
})
