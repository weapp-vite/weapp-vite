import type { PackageJson } from 'pkg-types'
import { describe, expect, it, vi } from 'vitest'
import { resolveDependencyVersions } from '../src/dependencyVersions'
import { getPackageVersionsFromNpm } from '../src/npm'
import { logger } from '../vitest.setup'

vi.mock('../../weapp-vite/package.json', () => ({ version: '7.2.0-beta.1' }))
vi.mock('../../../packages-runtime/wevu/package.json', () => ({ version: '7.1.4' }))
vi.mock('../../dashboard/package.json', () => ({ version: '7.1.4' }))
vi.mock('../src/npm', () => ({ getPackageVersionsFromNpm: vi.fn() }))

describe('prerelease dependency baselines', () => {
  it('retains the complete bundled combination in every field without querying the registry', async () => {
    const pkg: PackageJson = {
      dependencies: { 'weapp-vite': 'workspace:*' },
      devDependencies: { 'weapp-vite': 'workspace:*', 'wevu': 'workspace:*' },
      peerDependencies: { 'weapp-vite': 'workspace:*' },
      optionalDependencies: { 'weapp-vite': 'workspace:*', '@weapp-vite/dashboard': 'workspace:*' },
    }

    await resolveDependencyVersions(pkg)

    expect(getPackageVersionsFromNpm).not.toHaveBeenCalled()
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const) {
      expect(pkg[field]?.['weapp-vite']).toBe('^7.2.0-beta.1')
    }
    expect(pkg.devDependencies?.wevu).toBe('^7.1.4')
    expect(pkg.optionalDependencies?.['@weapp-vite/dashboard']).toBe('^7.1.4')
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('预发布基线保持随包版本'))
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('weapp-vite@7.2.0-beta.1、wevu@7.1.4、@weapp-vite/dashboard@7.1.4'))
  })
})
