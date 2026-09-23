import type { RuntimeSizeReport } from './runtime-size'

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { collectPerformanceReports } from '../.github/scripts/performance-comment-report.mjs'
import { renderSuccessComment, validateArtifact } from '../.github/scripts/upsert-runtime-size-comment.mjs'
import {
  assertRuntimeSizeReport,
  collectRuntimeSizeReport,
  createRuntimeSizeBuildOptions,
  createRuntimeSizeLegacyArtifact,
  createRuntimeSizePrArtifact,
  runtimeSizeTargets,
  runtimeSizeTiers,
} from './runtime-size'

async function createReport() {
  return collectRuntimeSizeReport({
    root: '/repo',
    commit: 'abc1234',
    bundle: async ({ target, tier, mode }) => {
      const entry = `${target.id}-${tier.id}-${mode}.mjs`
      return {
        contents: new Uint8Array(100),
        retainedModules: { entry, modules: [{ path: entry, bytesInOutput: 100, imports: [] }] },
      }
    },
  })
}

describe('platform runtime size coverage', () => {
  it('measures six mini-program targets and web with public named imports', () => {
    expect(runtimeSizeTargets.map(target => target.id)).toEqual(['weapp', 'alipay', 'tt', 'swan', 'jd', 'xhs', 'web'])
    expect(runtimeSizeTiers.map(tier => tier.id)).toEqual([
      'reactivity-core',
      'minimal-app',
      'typical-page',
      'complex-component',
      'public-app',
      'public-page',
      'full-provider',
    ])
    for (const target of runtimeSizeTargets) {
      const options = createRuntimeSizeBuildOptions({
        root: '/repo',
        target,
        tier: runtimeSizeTiers.find(tier => tier.id === 'public-page')!,
        mode: 'production',
      })
      expect(options.define?.['import.meta.env.PLATFORM']).toBe(JSON.stringify(target.id))
      expect(options.stdin?.contents).toContain('from "wevu"')
      expect(options.stdin?.contents).toContain('createWevuComponent as')
      expect(options.stdin?.contents).not.toMatch(/wevu\/(?:router|jsx|api)/)
    }
  })

  it('rejects missing and duplicate measurements instead of passing incomplete guards', async () => {
    const missingTarget = await createReport()
    missingTarget.targets.pop()
    expect(() => assertRuntimeSizeReport(missingTarget)).toThrow(/targets/)
    const missingTier = await createReport()
    missingTier.targets[0]!.tiers.pop()
    expect(() => assertRuntimeSizeReport(missingTier)).toThrow(/tiers/)
    const duplicate = await createReport()
    duplicate.targets[1] = duplicate.targets[0]!
    expect(() => assertRuntimeSizeReport(duplicate)).toThrow(/targets/)
  })

  it.each([
    'packages-runtime/wevu/dist/router/initialNavigation.mjs',
    'packages-runtime/wevu/dist/router/instance.mjs',
    '@weapp-core/api/dist/index.js',
    'packages-runtime/wevu/dist/fetch.mjs',
    'packages-runtime/web-apis/dist/fetch.mjs',
  ])('rejects live optional capabilities in public tiers: %s', async (modulePath) => {
    const report = await createReport()
    const tier = report.targets[0]!.tiers.find(tier => tier.id === 'public-app')!
    tier.production.retainedModules.modules.push({ path: modulePath, bytesInOutput: 10, imports: [] })
    expect(() => assertRuntimeSizeReport(report)).toThrow(/retained denied module/)
    tier.production.retainedModules.modules.at(-1)!.bytesInOutput = 0
    expect(() => assertRuntimeSizeReport(report)).not.toThrow()
  })

  it('keeps dynamic public factory capabilities while rejecting unused compiler JSX handlers', async () => {
    const report = await createReport()
    const publicTier = report.targets[0]!.tiers.find(tier => tier.id === 'public-page')!
    const compilerTier = report.targets[0]!.tiers.find(tier => tier.id === 'typical-page')!
    const modules = [
      'packages-runtime/wevu/dist/runtime/jsxIsland.mjs',
      'packages-runtime/wevu/dist/runtime/features/jsxIslands.mjs',
      'packages-runtime/wevu/dist/runtime/scopedSlots.mjs',
      'packages-runtime/wevu/dist/router/routeSync.mjs',
      'packages-runtime/web-apis/dist/index.mjs',
    ].map(path => ({ path, bytesInOutput: 10, imports: [] }))
    publicTier.production.retainedModules.modules.push(...modules)
    expect(() => assertRuntimeSizeReport(report)).not.toThrow()
    compilerTier.production.retainedModules.modules.push(modules[0]!)
    expect(() => assertRuntimeSizeReport(report)).toThrow(/jsxIsland/)
  })

  it('rejects foreign platform adapters while allowing the matching adapter', async () => {
    const report = await createReport()
    const module = {
      path: 'packages-runtime/wevu/dist/runtime/register/component/alipayRegistration.mjs',
      bytesInOutput: 100,
      imports: [],
    }
    const alipay = report.targets.find(target => target.id === 'alipay')!.tiers[1]!
    alipay.production.retainedModules.modules.push(module)
    expect(() => assertRuntimeSizeReport(report)).not.toThrow()
    report.targets[0]!.tiers[1]!.production.retainedModules.modules.push(module)
    expect(() => assertRuntimeSizeReport(report)).toThrow(/target=weapp.*alipayRegistration/)
  })

  it('rejects the generic fallback in a statically selected platform', async () => {
    const report = await createReport()
    report.targets[0]!.tiers[1]!.production.retainedModules.modules.push({
      path: 'packages-runtime/wevu/dist/runtime/platform/generic.mjs',
      bytesInOutput: 100,
      imports: [],
    })
    expect(() => assertRuntimeSizeReport(report)).toThrow(/platform\/generic/)
  })

  it.each([
    '@weapp-core/shared/dist/platforms/descriptors.js',
    '@weapp-core/shared/dist/platforms/helpers.js',
    '@weapp-core/shared/dist/platforms/index.js',
    '@weapp-core/shared/dist/platforms-legacy.js',
  ])('rejects build metadata reintroduced through full Web provider: %s', async (modulePath) => {
    const report = await createReport()
    const tier = report.targets.find(target => target.id === 'web')!.tiers.find(tier => tier.id === 'full-provider')!
    const retained = tier.production.retainedModules
    const importer = 'packages-runtime/web/dist/runtime/polyfill/index.mjs'
    retained.modules[0]!.imports.push(importer)
    retained.modules.push(
      { path: importer, bytesInOutput: 20, imports: [modulePath] },
      { path: modulePath, bytesInOutput: 10, imports: [] },
    )
    expect(() => assertRuntimeSizeReport(report)).toThrow(`chain=${retained.entry} -> ${importer} -> ${modulePath}`)
    retained.modules.at(-1)!.bytesInOutput = 0
    expect(() => assertRuntimeSizeReport(report)).not.toThrow()
  })

  it('allows shared runtime descriptors and required Web scheduling helpers', async () => {
    const report = await createReport()
    const tier = report.targets.find(target => target.id === 'web')!.tiers.find(tier => tier.id === 'public-page')!
    tier.production.retainedModules.modules.push(...[
      '@weapp-core/shared/dist/platforms/runtime/descriptors.js',
      '@weapp-core/shared/dist/platforms/runtime/helpers.js',
      'packages-runtime/web-apis/dist/task.mjs',
      'packages-runtime/web-apis/dist/shared.mjs',
    ].map(path => ({ path, bytesInOutput: 10, imports: [] })))
    expect(() => assertRuntimeSizeReport(report)).not.toThrow()
  })

  it('projects a coherent v2 artifact while preserving the complete v4 report', async () => {
    const current = await createReport()
    const artifact = createRuntimeSizePrArtifact({
      repository: 'owner/repo',
      prNumber: 42,
      headSha: 'a'.repeat(40),
      baseSha: 'b'.repeat(40),
      current,
      baseline: current,
    })
    const legacy = createRuntimeSizeLegacyArtifact(artifact)
    expect(artifact.version).toBe(4)
    expect(artifact.current.targets).toHaveLength(7)
    expect(legacy.version).toBe(2)
    expect(legacy.current.version).toBe(2)
    expect(legacy.baseline.version).toBe(2)
    expect(legacy.current.targets.map(target => target.id)).toEqual(['weapp', 'web'])
    expect(legacy.current.targets[0]!.tiers.map(tier => tier.id)).toEqual([
      'reactivity-core',
      'minimal-app',
      'typical-page',
      'complex-component',
      'full-provider',
    ])
    expect(validateArtifact(legacy, {}).version).toBe(2)
    expect(validateArtifact(artifact, {}).version).toBe(4)
    expect(renderSuccessComment(artifact)).toContain('公共入口典型页面')
    expect(renderSuccessComment(artifact)).toContain('小红书小程序')
  })

  it('prefers the complete report when the compatibility artifact is present', async () => {
    const current = await createReport()
    const artifact = createRuntimeSizePrArtifact({
      repository: 'owner/repo',
      prNumber: 42,
      headSha: 'a'.repeat(40),
      baseSha: 'b'.repeat(40),
      current,
      baseline: current,
    })
    const root = await mkdtemp(path.join(os.tmpdir(), 'wevu-runtime-size-artifacts-'))
    try {
      await writeFile(path.join(root, 'report-full.json'), JSON.stringify(artifact))
      await writeFile(path.join(root, 'report.json'), JSON.stringify(createRuntimeSizeLegacyArtifact(artifact)))
      const collected = await collectPerformanceReports({ runtimeRoot: root, performanceRoot: undefined, runtimeExpected: {} }) as {
        errors: string[]
        runtimeSize?: { current: RuntimeSizeReport }
      }
      expect(collected.errors).toEqual([])
      expect(collected.runtimeSize?.current.version).toBe(4)
      expect(collected.runtimeSize?.current.targets).toHaveLength(7)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects mixed versions and malformed v4 measurement graphs', async () => {
    const current = await createReport()
    const artifact = createRuntimeSizePrArtifact({
      repository: 'owner/repo',
      prNumber: 42,
      headSha: 'a'.repeat(40),
      baseSha: 'b'.repeat(40),
      current,
      baseline: current,
    })
    expect(() => validateArtifact({ ...artifact, baseline: { ...current, version: 2 } }, {})).toThrow(/version must match/)
    current.targets[0]!.tiers[0]!.production.retainedModules.modules.length = 0
    expect(() => validateArtifact(artifact, {})).toThrow(/must contain its entry/)
  })
})
