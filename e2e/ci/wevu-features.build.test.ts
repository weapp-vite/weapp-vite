import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/wevu-features')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await execa('node', [CLI_PATH, 'build', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
    cwd: APP_ROOT,
  })
}

describe.sequential('e2e app: wevu-features (build)', () => {
  it('builds useAttrs showcase app and emits expected outputs', async () => {
    await runBuild()

    const appJsonPath = path.join(DIST_ROOT, 'app.json')
    const indexWxmlPath = path.join(DIST_ROOT, 'pages/index/index.wxml')
    const indexJsPath = path.join(DIST_ROOT, 'pages/index/index.js')
    const useAttrsPageWxmlPath = path.join(DIST_ROOT, 'pages/use-attrs/index.wxml')
    const useAttrsPageJsPath = path.join(DIST_ROOT, 'pages/use-attrs/index.js')
    const useAttrsFeatureWxmlPath = path.join(DIST_ROOT, 'components/use-attrs-feature/index.wxml')

    expect(await fs.pathExists(appJsonPath)).toBe(true)
    expect(await fs.pathExists(indexWxmlPath)).toBe(true)
    expect(await fs.pathExists(indexJsPath)).toBe(true)
    expect(await fs.pathExists(useAttrsPageWxmlPath)).toBe(true)
    expect(await fs.pathExists(useAttrsPageJsPath)).toBe(true)
    expect(await fs.pathExists(useAttrsFeatureWxmlPath)).toBe(true)

    const appJson = await fs.readJson(appJsonPath)
    const indexWxml = await fs.readFile(indexWxmlPath, 'utf8')
    const indexJs = await fs.readFile(indexJsPath, 'utf8')
    const useAttrsPageWxml = await fs.readFile(useAttrsPageWxmlPath, 'utf8')
    const useAttrsPageJs = await fs.readFile(useAttrsPageJsPath, 'utf8')
    const useAttrsFeatureWxml = await fs.readFile(useAttrsFeatureWxmlPath, 'utf8')

    expect(appJson.pages).toEqual([
      'pages/index/index',
      'pages/use-attrs/index',
      'pages/use-slots/index',
      'pages/use-model/index',
      'pages/use-provide-inject/index',
      'pages/use-store/index',
    ])

    expect(indexWxml).toContain('url="{{item.path}}"')
    expect(indexJs).toContain('/pages/use-attrs/index')
    expect(indexJs).toContain('/pages/use-slots/index')
    expect(indexJs).toContain('/pages/use-model/index')
    expect(indexJs).toContain('/pages/use-provide-inject/index')
    expect(indexJs).toContain('/pages/use-store/index')
    expect(indexJs).toContain('useAttrs')
    expect(indexJs).toContain('useSlots')
    expect(indexJs).toContain('useModel')
    expect(indexJs).toContain('provide / inject')
    expect(indexJs).toContain('store')

    expect(useAttrsPageWxml).toContain('<UseAttrsFeature')
    expect(useAttrsPageWxml).toContain('stateClass="{{currentToneClass}}"')
    expect(useAttrsPageWxml).toContain('visible="{{controlState.visible}}"')
    expect(useAttrsPageWxml).toContain('badgeStyle="{{currentBadgeStyle}}"')
    expect(useAttrsPageWxml).toContain('extraLabel="{{currentExtraLabel}}"')
    expect(useAttrsPageWxml).toContain('seedTag="{{controlState.seed}}"')
    expect(useAttrsPageWxml).toContain('bindtap="cycleToneClass"')
    expect(useAttrsPageWxml).toContain('bindtap="toggleVisible"')
    expect(useAttrsPageWxml).toContain('bindtap="toggleStrongBorder"')
    expect(useAttrsPageWxml).toContain('bindtap="bumpSeed"')

    expect(useAttrsPageJs).toContain('controlState')
    expect(useAttrsPageJs).toContain('runE2E')
    expect(useAttrsPageJs).toContain('_runE2E')

    expect(useAttrsFeatureWxml).toContain('wx:if="{{visible}}"')
    expect(useAttrsFeatureWxml).toContain('wx:for="{{attrRows}}"')
    expect(useAttrsFeatureWxml).toMatch(/class="\{\{__wv_cls_\d+\}\}"/)

    const useSlotsPageWxmlPath = path.join(DIST_ROOT, 'pages/use-slots/index.wxml')
    const useSlotsPageJsPath = path.join(DIST_ROOT, 'pages/use-slots/index.js')
    const useSlotsFeatureWxmlPath = path.join(DIST_ROOT, 'components/use-slots-feature/index.wxml')

    const useModelPageWxmlPath = path.join(DIST_ROOT, 'pages/use-model/index.wxml')
    const useModelPageJsPath = path.join(DIST_ROOT, 'pages/use-model/index.js')
    const useModelFeatureWxmlPath = path.join(DIST_ROOT, 'components/use-model-feature/index.wxml')
    const useProvideInjectPageWxmlPath = path.join(DIST_ROOT, 'pages/use-provide-inject/index.wxml')
    const useProvideInjectPageJsPath = path.join(DIST_ROOT, 'pages/use-provide-inject/index.js')
    const useProvideInjectFeatureWxmlPath = path.join(DIST_ROOT, 'components/use-provide-inject-feature/index.wxml')
    const useStorePageWxmlPath = path.join(DIST_ROOT, 'pages/use-store/index.wxml')
    const useStorePageJsPath = path.join(DIST_ROOT, 'pages/use-store/index.js')

    expect(await fs.pathExists(useSlotsPageWxmlPath)).toBe(true)
    expect(await fs.pathExists(useSlotsPageJsPath)).toBe(true)
    expect(await fs.pathExists(useSlotsFeatureWxmlPath)).toBe(true)
    expect(await fs.pathExists(useModelPageWxmlPath)).toBe(true)
    expect(await fs.pathExists(useModelPageJsPath)).toBe(true)
    expect(await fs.pathExists(useModelFeatureWxmlPath)).toBe(true)
    expect(await fs.pathExists(useProvideInjectPageWxmlPath)).toBe(true)
    expect(await fs.pathExists(useProvideInjectPageJsPath)).toBe(true)
    expect(await fs.pathExists(useProvideInjectFeatureWxmlPath)).toBe(true)
    expect(await fs.pathExists(useStorePageWxmlPath)).toBe(true)
    expect(await fs.pathExists(useStorePageJsPath)).toBe(true)

    const useSlotsPageWxml = await fs.readFile(useSlotsPageWxmlPath, 'utf8')
    const useSlotsPageJs = await fs.readFile(useSlotsPageJsPath, 'utf8')
    const useSlotsFeatureWxml = await fs.readFile(useSlotsFeatureWxmlPath, 'utf8')
    const useModelPageWxml = await fs.readFile(useModelPageWxmlPath, 'utf8')
    const useModelPageJs = await fs.readFile(useModelPageJsPath, 'utf8')
    const useModelFeatureWxml = await fs.readFile(useModelFeatureWxmlPath, 'utf8')
    const useProvideInjectPageWxml = await fs.readFile(useProvideInjectPageWxmlPath, 'utf8')
    const useProvideInjectPageJs = await fs.readFile(useProvideInjectPageJsPath, 'utf8')
    const useProvideInjectFeatureWxml = await fs.readFile(useProvideInjectFeatureWxmlPath, 'utf8')
    const useStorePageWxml = await fs.readFile(useStorePageWxmlPath, 'utf8')
    const useStorePageJs = await fs.readFile(useStorePageJsPath, 'utf8')

    expect(useSlotsPageWxml).toContain('<UseSlotsFeature')
    expect(useSlotsPageWxml).toContain('bindtap="toggleOpen"')
    expect(useSlotsPageWxml).toContain('bindtap="toggleHeader"')
    expect(useSlotsPageWxml).toContain('bindtap="bumpCount"')
    expect(useSlotsPageJs).toContain('_runE2E')
    expect(useSlotsFeatureWxml).toContain('id="slots-panel"')
    expect(useSlotsFeatureWxml).toContain('id="slots-summary"')

    expect(useModelPageWxml).toContain('<UseModelFeature')
    expect(useModelPageWxml).toContain('model-value="{{modelValue}}"')
    expect(useModelPageWxml).toContain('bind:update:modelValue="__weapp_vite_inline"')
    expect(useModelPageWxml).toContain('bindtap="setParentAlpha"')
    expect(useModelPageWxml).toContain('bindtap="setParentBeta"')
    expect(useModelPageJs).toContain('_runE2E')
    expect(useModelFeatureWxml).toContain('id="model-inner-value"')
    expect(useModelFeatureWxml).toContain('bindtap="__weapp_vite_inline"')

    expect(useProvideInjectPageWxml).toContain('<UseProvideInjectFeature')
    expect(useProvideInjectPageWxml).toContain('bindtap="providerIncrementTap"')
    expect(useProvideInjectPageWxml).toContain('bindtap="providerToggleThemeTap"')
    expect(useProvideInjectPageWxml).toContain('id="provide-inc"')
    expect(useProvideInjectPageWxml).toContain('id="provide-toggle-theme"')
    expect(useProvideInjectPageWxml).toContain('id="provide-state"')
    expect(useProvideInjectPageJs).toContain('_runE2E')
    expect(useProvideInjectFeatureWxml).toContain('id="inject-panel"')
    expect(useProvideInjectFeatureWxml).toContain('id="inject-inc"')
    expect(useProvideInjectFeatureWxml).toContain('id="inject-toggle-theme"')

    expect(useStorePageWxml).toContain('id="store-plugin-records"')
    expect(useStorePageWxml).toContain('id="store-subscribe-count"')
    expect(useStorePageWxml).toContain('id="store-subscribe-last"')
    expect(useStorePageWxml).toContain('id="store-action-counts"')
    expect(useStorePageWxml).toContain('id="store-action-last"')
    expect(useStorePageWxml).toContain('id="store-setup-inc"')
    expect(useStorePageWxml).toContain('id="store-setup-patch-object"')
    expect(useStorePageWxml).toContain('id="store-setup-ref-write"')
    expect(useStorePageWxml).toContain('id="store-options-inc"')
    expect(useStorePageWxml).toContain('id="store-options-patch-fn"')
    expect(useStorePageWxml).toContain('id="store-options-ref-write"')
    expect(useStorePageWxml).toContain('bindtap="setupInc"')
    expect(useStorePageWxml).toContain('bindtap="setupPatchObject"')
    expect(useStorePageWxml).toContain('bindtap="optionsPatchFunction"')
    expect(useStorePageWxml).toContain('bindtap="optionsRefWrite"')
    expect(useStorePageJs).toContain('featureSetupCounter')
    expect(useStorePageJs).toContain('featureOptionsCounter')
    expect(useStorePageJs).toContain('_runE2E')
  })
})
