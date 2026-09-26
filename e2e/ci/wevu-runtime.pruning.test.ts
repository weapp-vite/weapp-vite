import { access } from 'node:fs/promises'
import path from 'node:path'
import { WEVU_INITIAL_NAVIGATION_TIMEOUT_MARKER, WEVU_JSX_ISLAND_HANDLER_MAP_KEY } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { BUILD_VERIFICATION_CAPABILITIES } from '../platforms/verification'
import { buildRuntimePruning, readRuntimePruningScripts, RUNTIME_PRUNING_DIST, RUNTIME_PRUNING_ROOT, RUNTIME_PUBLIC_FACTORY_ROOT } from '../utils/runtimePruning'

describe('issue #1064: platform-specialized consumer bundles', { concurrent: false }, () => {
  it.each(BUILD_VERIFICATION_CAPABILITIES)('prunes unused runtime in $id main and subpackages', async ({ id, expectation }) => {
    await buildRuntimePruning(id)
    for (const route of ['pages/index/index', 'detail/index']) {
      for (const extension of ['js', 'json', expectation.templateExt]) {
        await expect(access(path.join(RUNTIME_PRUNING_DIST, `${route}.${extension}`))).resolves.toBeUndefined()
      }
    }
    const code = await readRuntimePruningScripts()
    const forbidden = [WEVU_INITIAL_NAVIGATION_TIMEOUT_MARKER, WEVU_JSX_ISLAND_HANDLER_MAP_KEY, 'resolvePreservedNpmDirNames', 'setAdapter']
    expect(forbidden.filter(marker => code.includes(marker))).toEqual([])
    if (id !== 'alipay') {
      expect(code.includes('deriveDataFromProps')).toBe(false)
    }
  })

  it('preserves the Web host bridge without mini-program adapters', async () => {
    await buildRuntimePruning('web')
    const code = await readRuntimePruningScripts(path.join(RUNTIME_PRUNING_ROOT, 'dist/web'))
    expect(code).toContain('pruning-page')
    const forbidden = [WEVU_INITIAL_NAVIGATION_TIMEOUT_MARKER, 'resolvePreservedNpmDirNames', 'deriveDataFromProps']
    expect(forbidden.filter(marker => code.includes(marker))).toEqual([])
  })

  it('keeps dynamic public factories compatible with JSX island events', async () => {
    await buildRuntimePruning('weapp', RUNTIME_PUBLIC_FACTORY_ROOT)
    const outputRoot = path.join(RUNTIME_PUBLIC_FACTORY_ROOT, 'dist')
    for (const extension of ['js', 'json', 'wxml']) {
      await expect(access(path.join(outputRoot, `pages/index/index.${extension}`))).resolves.toBeUndefined()
    }
    const code = await readRuntimePruningScripts(outputRoot)
    expect(code).toContain(WEVU_JSX_ISLAND_HANDLER_MAP_KEY)
    expect(code).toContain('__weapp_vite_jsx_island')
  })
})
