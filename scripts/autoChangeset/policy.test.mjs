import { describe, expect, it } from 'vitest'
import { affectedPackages, hasManualChangeset, isUnmodifiedGenerated, releaseLevel, renderChangeset, workspaceManifestPaths } from '../../.github/auto-changeset/policy.mjs'

const pkg = (dir, name, manifest = {}) => ({ dir, name, manifest })
const changed = filename => ({ filename, status: 'modified' })

describe('automatic release intent policy', () => {
  it('discovers all workspace roots and honors exclusions without executing candidate code', () => {
    const manifest = 'packages:\n  - packages/*\n  - packages-runtime/*\n  - mpcore/packages/*\n  - "@weapp-core/*"\n  - "!packages/private"\n'
    expect(workspaceManifestPaths([
      'packages/core/package.json',
      'packages/private/package.json',
      'packages/core/test/fixture/package.json',
      'packages-runtime/wevu/package.json',
      'mpcore/packages/test/package.json',
      '@weapp-core/constants/package.json',
    ], manifest)).toEqual(['packages/core/package.json', 'packages-runtime/wevu/package.json', 'mpcore/packages/test/package.json', '@weapp-core/constants/package.json'])
  })

  it('links wevu, templates and constants changes to the required public packages', () => {
    const workspaces = [pkg('packages-runtime/wevu', 'wevu'), pkg('packages/core', 'core', { dependencies: { '@weapp-core/constants': 'workspace:*' } }), pkg('@weapp-core/constants', '@weapp-core/constants')]
    expect(affectedPackages([changed('packages-runtime/wevu/src/index.ts')], workspaces)).toEqual(['create-weapp-vite', 'wevu'])
    expect(affectedPackages([changed('templates/vue/package.json')], workspaces)).toEqual(['create-weapp-vite'])
    expect(affectedPackages([changed('@weapp-core/constants/src/index.ts')], workspaces)).toEqual(['@weapp-core/constants', 'core'])
  })

  it('includes constants consumers through npm and workspace aliases', () => {
    const workspaces = [
      pkg('@weapp-core/constants', '@weapp-core/constants'),
      pkg('packages/direct', 'direct', { dependencies: { '@weapp-core/constants': 'workspace:^1.0.0' } }),
      pkg('packages/aliased', 'aliased', { dependencies: { shared: 'workspace:@weapp-core/constants@*' } }),
      pkg('packages/npm-alias', 'npm-alias', { optionalDependencies: { shared: 'npm:@weapp-core/constants@1.0.0' } }),
      pkg('packages/relative', 'relative', { devDependencies: { shared: 'workspace:../../@weapp-core/constants' } }),
      pkg('packages/unrelated', 'unrelated', { dependencies: { '@weapp-core/constants': 'npm:unrelated@1.0.0' } }),
    ]
    expect(affectedPackages([changed('@weapp-core/constants/src/index.ts')], workspaces)).toEqual([
      '@weapp-core/constants',
      'aliased',
      'direct',
      'npm-alias',
      'relative',
    ])
  })

  it('does not release tests, docs or emitted artifacts', () => {
    const files = ['src/index.test.ts', 'test/index.ts', 'README.md', 'docs/api.md', 'dist/index.js'].map(file => changed(`packages/core/${file}`))
    expect(affectedPackages(files, [pkg('packages/core', 'core')])).toEqual([])
  })

  it('preserves hand-written intents, excluding README and deleted files', () => {
    expect(hasManualChangeset([changed('.changeset/deps.md')], 1)).toBe(true)
    expect(hasManualChangeset([changed('.changeset/README.md'), changed('.changeset/auto-pr-1.md'), { filename: '.changeset/removed.md', status: 'removed' }], 1)).toBe(false)
  })

  it('uses consumer impact, requiring an explicit choice for breaking titles', () => {
    expect(releaseLevel('chore(deps): 更新上游 major 依赖')).toBe('patch')
    expect(releaseLevel('feat: 增加新能力')).toBe('minor')
    expect(() => releaseLevel('chore(deps)!: 收紧环境要求')).toThrow('显式')
    expect(releaseLevel('chore(deps)!: 收紧环境要求', ['release:minor'])).toBe('minor')
    expect(() => releaseLevel('fix: 修复问题', ['release:minor', 'release:major'])).toThrow('一个')
  })

  it('requires a Chinese conventional summary and detects manual changes', () => {
    const input = { packages: ['wevu', 'create-weapp-vite'], number: 1, title: 'fix: 修复生命周期', level: 'patch' }
    const content = renderChangeset(input)
    expect(content).toContain('"create-weapp-vite": patch')
    expect(isUnmodifiedGenerated(content)).toBe(true)
    expect(isUnmodifiedGenerated(content.replace('修复生命周期', '人工迁移说明'))).toBe(false)
    expect(() => renderChangeset({ ...input, title: 'fix: lifecycle' })).toThrow('中文')
  })
})
