import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveNpmBuildCandidateDependenciesSync } from '../../../runtime/npmPlugin/service/dependencies'
import { createEntryNormalizer } from './normalizer'

let projectRoot: string

function createConfigService() {
  return {
    cwd: projectRoot,
    weappViteConfig: { npm: {} },
    aliasEntries: [{ find: '@', replacement: '/project/src' }],
    absoluteSrcRoot: '/project/src',
    packageJson: {
      dependencies: {
        'tdesign-miniprogram': '^1.0.0',
        '@scope/pkg': '^1.0.0',
      },
    },
    relativeAbsoluteSrcRoot: vi.fn((id: string) => id.replace('/project/src/', '')),
  } as any
}

describe('useLoadEntry normalizer', () => {
  beforeEach(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'weapp-vite-entry-normalizer-'))
    for (const name of ['tdesign-miniprogram', '@scope/pkg', 'dev-only-tool']) {
      const packageRoot = path.join(projectRoot, 'node_modules', name)
      fs.mkdirSync(packageRoot, { recursive: true })
      fs.writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify({
        name,
        version: '1.0.0',
        main: 'index.js',
        ...(name === 'dev-only-tool' ? {} : { miniprogram: 'miniprogram_dist' }),
      }))
      fs.writeFileSync(path.join(packageRoot, 'index.js'), '')
    }
  })

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true })
  })

  it('keeps plugin protocol entries untouched', () => {
    const normalizeEntry = createEntryNormalizer(createConfigService())
    expect(normalizeEntry('plugin://demo/card', '/project/src/app.json')).toBe('plugin://demo/card')
  })

  it('normalizes dependency entries into npm protocol for scoped and unscoped packages', () => {
    const normalizeEntry = createEntryNormalizer(createConfigService())

    expect(normalizeEntry('tdesign-miniprogram/button/button', '/project/src/app.json')).toBe('npm:tdesign-miniprogram/button/button')
    expect(normalizeEntry('@scope/pkg/button/index', '/project/src/app.json')).toBe('npm:@scope/pkg/button/index')
  })

  it('keeps absolute entries repo-relative and resolves aliases for local entries', () => {
    const configService = createConfigService()
    const normalizeEntry = createEntryNormalizer(configService)

    expect(normalizeEntry('/components/Card/index', '/project/src/app.json')).toBe('components/Card/index')
    expect(normalizeEntry('@/components/Card/index', '/project/src/pages/home/index.json')).toBe('components/Card/index')
    expect(configService.relativeAbsoluteSrcRoot).toHaveBeenCalledWith('/project/src/components/Card/index')
  })

  it('handles windows separators before dependency and local path normalization', () => {
    const normalizeEntry = createEntryNormalizer(createConfigService())

    expect(normalizeEntry('tdesign-miniprogram\\button\\button', '/project/src/app.json')).toBe('npm:tdesign-miniprogram/button/button')
    expect(normalizeEntry('\\components\\Card\\index', '/project/src/app.json')).toBe('components/Card/index')
  })

  it('uses the same miniprogram npm candidates for packages declared only in devDependencies', () => {
    const configService = createConfigService()
    configService.packageJson = {
      devDependencies: {
        'tdesign-miniprogram': '^1.0.0',
        '@scope/pkg': '^1.0.0',
      },
    }
    expect(resolveNpmBuildCandidateDependenciesSync({ configService } as any, configService.packageJson)).toEqual([
      'tdesign-miniprogram',
      '@scope/pkg',
    ])
    const normalizeEntry = createEntryNormalizer(configService)

    expect(normalizeEntry('tdesign-miniprogram/message/message', '/project/src/layouts/compact/index.json')).toBe('npm:tdesign-miniprogram/message/message')
    expect(normalizeEntry('@scope/pkg/toast/toast', '/project/src/layouts/compact/index.json')).toBe('npm:@scope/pkg/toast/toast')
    expect(normalizeEntry('tdesign-miniprogram\\toast\\toast', '/project/src/layouts/compact/index.json')).toBe('npm:tdesign-miniprogram/toast/toast')
    expect(normalizeEntry('@/components/Card/index', '/project/src/layouts/compact/index.json')).toBe('components/Card/index')
  })

  it('does not turn ordinary dev tools into npm components', () => {
    const configService = createConfigService()
    configService.packageJson = { devDependencies: { 'dev-only-tool': '^1.0.0' } }
    expect(resolveNpmBuildCandidateDependenciesSync({ configService } as any, configService.packageJson)).toEqual([])
    const normalizeEntry = createEntryNormalizer(configService)

    expect(normalizeEntry('dev-only-tool/card/index', '/project/src/layouts/compact/index.json')).toBe('layouts/compact/dev-only-tool/card/index')
    expect(normalizeEntry('./card/index', '/project/src/layouts/compact/index.json')).toBe('layouts/compact/card/index')
  })

  it('recognizes ordinary dev dependencies when explicitly included as npm candidates', () => {
    const configService = createConfigService()
    configService.packageJson = { devDependencies: { 'dev-only-tool': '^1.0.0' } }
    configService.weappViteConfig.npm = { include: ['dev-only-tool'] }
    expect(resolveNpmBuildCandidateDependenciesSync({ configService } as any, configService.packageJson)).toEqual(['dev-only-tool'])
    const normalizeEntry = createEntryNormalizer(configService)

    expect(normalizeEntry('dev-only-tool/card/index', '/project/src/layouts/compact/index.json')).toBe('npm:dev-only-tool/card/index')
  })

  it('keeps legacy npm candidates limited to dependencies', () => {
    const configService = createConfigService()
    configService.packageJson = {
      dependencies: { 'legacy-component': '^1.0.0' },
      devDependencies: { 'tdesign-miniprogram': '^1.0.0' },
    }
    configService.weappViteConfig.npm = { strategy: 'legacy' }
    expect(resolveNpmBuildCandidateDependenciesSync({ configService } as any, configService.packageJson)).toEqual(['legacy-component'])
    const normalizeEntry = createEntryNormalizer(configService)

    expect(normalizeEntry('legacy-component/card/index', '/project/src/layouts/compact/index.json')).toBe('npm:legacy-component/card/index')
    expect(normalizeEntry('tdesign-miniprogram/message/message', '/project/src/layouts/compact/index.json')).toBe('layouts/compact/tdesign-miniprogram/message/message')
  })

  it('uses fresh candidates for a new normalizer without changing the previous generation', () => {
    const firstConfig = createConfigService()
    firstConfig.packageJson = { devDependencies: { 'dev-only-tool': '^1.0.0' } }
    const firstNormalizer = createEntryNormalizer(firstConfig)
    const nextConfig = {
      ...firstConfig,
      weappViteConfig: { npm: { include: ['dev-only-tool'] } },
    }
    const nextNormalizer = createEntryNormalizer(nextConfig)

    expect(firstNormalizer('dev-only-tool/card/index', '/project/src/layouts/compact/index.json')).toBe('layouts/compact/dev-only-tool/card/index')
    expect(nextNormalizer('dev-only-tool/card/index', '/project/src/layouts/compact/index.json')).toBe('npm:dev-only-tool/card/index')
    expect(firstNormalizer('dev-only-tool/card/index', '/project/src/layouts/compact/index.json')).toBe('layouts/compact/dev-only-tool/card/index')
  })
})
