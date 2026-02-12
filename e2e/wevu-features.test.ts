import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { launchAutomator } from './utils/automator'

const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../e2e-apps/wevu-features')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

function stripAutomatorOverlay(wxml: string) {
  return wxml.replace(/\s*\.luna-dom-highlighter[\s\S]*$/, '')
}

function normalizeValue(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function readPageWxml(page: any) {
  const element = await page.$('page')
  if (!element) {
    throw new Error('Failed to find page element')
  }
  return stripAutomatorOverlay(await element.wxml())
}

async function resolveSelectorById(page: any, id: string) {
  const directSelector = `#${id}`
  const directElement = await page.$(directSelector)
  if (directElement) {
    return directSelector
  }

  const wxml = await readPageWxml(page)
  const scopedMatch = wxml.match(new RegExp(`id="([^"]*${escapeRegExp(id)})"`))
  if (scopedMatch?.[1]) {
    return `#${scopedMatch[1]}`
  }

  throw new Error(`Failed to resolve id selector: ${id}`)
}

async function readClassName(page: any, selector: string) {
  const element = await page.$(selector)
  if (!element) {
    throw new Error(`Failed to find element: ${selector}`)
  }
  return normalizeValue(await element.attribute('class') ?? '')
}

async function readStyleValue(page: any, selector: string) {
  const element = await page.$(selector)
  if (!element) {
    throw new Error(`Failed to find element: ${selector}`)
  }
  return normalizeValue(await element.attribute('style') ?? '')
}

async function tapControlUntil(page: any, tapSelector: string, checker: () => Promise<boolean>) {
  let controlElement = await page.$(tapSelector)
  if (!controlElement && tapSelector.startsWith('#')) {
    const scopedSelector = `[id="${tapSelector.slice(1)}"]`
    controlElement = await page.$(scopedSelector)
  }
  if (!controlElement) {
    throw new Error(`Failed to find tap element: ${tapSelector}`)
  }

  async function fireTapLikeEvent(mode: 'tap' | 'trigger' | 'touch' | 'dispatch') {
    if (mode === 'tap') {
      await controlElement.tap()
      return
    }
    if (mode === 'trigger') {
      await controlElement.trigger('tap')
      return
    }
    if (mode === 'touch') {
      await controlElement.touchstart()
      await controlElement.touchend()
      return
    }
    await controlElement.dispatchEvent({ eventName: 'tap' })
  }

  for (const mode of ['tap', 'trigger', 'touch', 'dispatch'] as const) {
    for (let index = 0; index < 2; index += 1) {
      try {
        await fireTapLikeEvent(mode)
      }
      catch {
      }

      await page.waitFor(220)
      if (await checker()) {
        return true
      }
    }
  }

  return checker()
}

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await execa('node', [CLI_PATH, 'build', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
    cwd: APP_ROOT,
  })
}

describe.sequential('e2e app: wevu-features', () => {
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

  it('updates runtime class and style via pure click controls', async () => {
    await runBuild()

    const miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })

    try {
      const page = await miniProgram.reLaunch('/pages/use-attrs/index')
      if (!page) {
        throw new Error('Failed to launch use-attrs page')
      }

      await page.waitFor(500)

      const visibleToggleButton = await page.$('#ctrl-toggle-visible')
      const toneButton = await page.$('#ctrl-cycle-tone')
      const borderButton = await page.$('#ctrl-toggle-border')
      const seedButton = await page.$('#ctrl-bump-seed')

      if (!visibleToggleButton || !toneButton || !borderButton || !seedButton) {
        throw new Error('Failed to find useAttrs runtime elements')
      }

      const beforeWxml = await readPageWxml(page)
      const beforeToneClass = await readClassName(page, '#ctrl-cycle-tone')
      const beforeVisibleClass = await readClassName(page, '#ctrl-toggle-visible')
      const beforeBorderClass = await readClassName(page, '#ctrl-toggle-border')
      const beforeBorderStyle = await readStyleValue(page, '#ctrl-toggle-border')

      expect(beforeToneClass).toContain('tone-blue')
      expect(beforeVisibleClass).toContain('ctrl-on')
      expect(beforeBorderClass).toContain('ctrl-dash')
      expect(beforeBorderStyle).toContain('dashed')
      expect(beforeWxml).toContain('组件内 useAttrs()')
      expect(beforeWxml).toContain('递增 seed：1')
      expect(beforeWxml).toContain('切换 visible：true')
      expect(beforeWxml).toContain('state-class = tone-blue')
      expect(beforeWxml).toContain('visible = true')
      expect(beforeWxml).toContain('extra-label = seed-1')
      expect(beforeWxml).toContain('state-class: tone-blue')
      expect(beforeWxml).toContain('visible: true')

      const toneApplied = await tapControlUntil(page, '#ctrl-cycle-tone', async () => {
        const afterToneWxml = await readPageWxml(page)
        return afterToneWxml.includes('切换 tone：tone-green')
          && afterToneWxml.includes('state-class = tone-green')
          && afterToneWxml.includes('state-class: tone-green')
      })
      expect(toneApplied).toBe(true)
      const afterToneClass = await readClassName(page, '#ctrl-cycle-tone')
      expect(afterToneClass).toContain('tone-green')
      expect(afterToneClass).not.toBe(beforeToneClass)

      const borderApplied = await tapControlUntil(page, '#ctrl-toggle-border', async () => {
        const afterBorderWxml = await readPageWxml(page)
        return afterBorderWxml.includes('边框模式：strong')
          && afterBorderWxml.includes('state-class = tone-green')
          && afterBorderWxml.includes('solid')
          && afterBorderWxml.includes('badge-style: border: 2rpx solid')
      })
      expect(borderApplied).toBe(true)
      const afterBorderClass = await readClassName(page, '#ctrl-toggle-border')
      const afterBorderStyle = await readStyleValue(page, '#ctrl-toggle-border')
      expect(afterBorderClass).toContain('ctrl-solid')
      expect(afterBorderClass).not.toContain('ctrl-dash')
      expect(afterBorderStyle).toContain('solid')
      expect(afterBorderStyle).not.toBe(beforeBorderStyle)

      const seedBumped = await tapControlUntil(page, '#ctrl-bump-seed', async () => {
        const afterSeedWxml = await readPageWxml(page)
        return afterSeedWxml.includes('递增 seed：2') && afterSeedWxml.includes('extra-label = seed-2')
      })
      expect(seedBumped).toBe(true)

      const visibleToggled = await tapControlUntil(page, '#ctrl-toggle-visible', async () => {
        const afterVisibleWxml = await readPageWxml(page)
        return afterVisibleWxml.includes('切换 visible：false')
          && afterVisibleWxml.includes('visible = false')
          && !afterVisibleWxml.includes('id="attrs-extra"')
      })
      expect(visibleToggled).toBe(true)

      const afterVisibleClass = await readClassName(page, '#ctrl-toggle-visible')
      expect(afterVisibleClass).toContain('ctrl-off')

      const finalWxml = await readPageWxml(page)
      expect(finalWxml).toContain('visible: false')
      expect(finalWxml).not.toContain('is-on')
    }
    finally {
      await miniProgram.close()
    }
  })

  it('updates runtime slots, model, provide/inject and store pages', async () => {
    await runBuild()

    const miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })

    try {
      const slotsPage = await miniProgram.reLaunch('/pages/use-slots/index')
      if (!slotsPage) {
        throw new Error('Failed to launch use-slots page')
      }

      await slotsPage.waitFor(500)
      const slotsResult = await slotsPage.callMethod('runE2E')
      expect(slotsResult?.ok).toBe(true)
      expect(slotsResult?.checks?.openChanged).toBe(true)
      expect(slotsResult?.checks?.headerChanged).toBe(true)
      expect(slotsResult?.checks?.countChanged).toBe(true)
      const slotsWxml = await readPageWxml(slotsPage)
      expect(slotsWxml).toContain('slots: []')

      const modelPage = await miniProgram.reLaunch('/pages/use-model/index')
      if (!modelPage) {
        throw new Error('Failed to launch use-model page')
      }

      await modelPage.waitFor(500)

      const modelResult = await modelPage.callMethod('runE2E')
      expect(modelResult?.ok).toBe(true)
      expect(modelResult?.checks?.valueChanged).toBe(true)
      expect(modelResult?.checks?.logsChanged).toBe(true)

      const parentValueBefore = await readPageWxml(modelPage)
      expect(parentValueBefore).toContain('parent modelValue = alpha-from-parent')

      const parentSetOk = await tapControlUntil(modelPage, '#model-parent-beta', async () => {
        const wxml = await readPageWxml(modelPage)
        return wxml.includes('parent modelValue = beta-from-parent')
      })
      expect(parentSetOk).toBe(true)

      const provideInjectPage = await miniProgram.reLaunch('/pages/use-provide-inject/index')
      if (!provideInjectPage) {
        throw new Error('Failed to launch use-provide-inject page')
      }

      await provideInjectPage.waitFor(500)

      const provideBeforeWxml = await readPageWxml(provideInjectPage)
      const provideBeforeClass = await readClassName(provideInjectPage, '#provide-state')
      expect(provideBeforeWxml).toContain('provider count = 1')
      expect(provideBeforeWxml).toContain('inject count = 1')
      expect(provideBeforeWxml).toContain('provider theme = teal')
      expect(provideBeforeWxml).toContain('inject theme = teal')
      expect(provideBeforeWxml).toContain('last action = init:provider')
      expect(provideBeforeClass).toContain('theme-teal')

      const providerIncOk = await tapControlUntil(provideInjectPage, '#provide-inc', async () => {
        const wxml = await readPageWxml(provideInjectPage)
        return wxml.includes('provider count = 2')
          && wxml.includes('inject count = 2')
          && wxml.includes('last action = inc:provider')
      })
      expect(providerIncOk).toBe(true)

      const injectIncSelector = await resolveSelectorById(provideInjectPage, 'inject-inc')
      const injectIncOk = await tapControlUntil(provideInjectPage, injectIncSelector, async () => {
        const wxml = await readPageWxml(provideInjectPage)
        return wxml.includes('provider count = 3')
          && wxml.includes('inject count = 3')
          && wxml.includes('last action = inc:inject')
      })
      expect(injectIncOk).toBe(true)

      const injectToggleThemeSelector = await resolveSelectorById(provideInjectPage, 'inject-toggle-theme')
      const injectToggleThemeOk = await tapControlUntil(provideInjectPage, injectToggleThemeSelector, async () => {
        const wxml = await readPageWxml(provideInjectPage)
        return wxml.includes('provider theme = amber')
          && wxml.includes('inject theme = amber')
          && wxml.includes('last action = theme:inject')
      })
      expect(injectToggleThemeOk).toBe(true)

      const provideThemeAfterInject = await readClassName(provideInjectPage, '#provide-state')
      expect(provideThemeAfterInject).toContain('theme-amber')

      const providerToggleThemeOk = await tapControlUntil(provideInjectPage, '#provide-toggle-theme', async () => {
        const wxml = await readPageWxml(provideInjectPage)
        return wxml.includes('provider theme = teal')
          && wxml.includes('inject theme = teal')
          && wxml.includes('last action = theme:provider')
      })
      expect(providerToggleThemeOk).toBe(true)

      const provideAfterClass = await readClassName(provideInjectPage, '#provide-state')
      expect(provideAfterClass).toContain('theme-teal')

      const storePage = await miniProgram.reLaunch('/pages/use-store/index')
      if (!storePage) {
        throw new Error('Failed to launch use-store page')
      }

      await storePage.waitFor(500)

      const storeBeforeWxml = await readPageWxml(storePage)
      const storeSetupBeforeClass = await readClassName(storePage, '#store-setup-count')
      const storeOptionsBeforeClass = await readClassName(storePage, '#store-options-count')
      expect(storeBeforeWxml).toContain('setup count = 0')
      expect(storeBeforeWxml).toContain('setup doubled = 0')
      expect(storeBeforeWxml).toContain('setup label = init')
      expect(storeBeforeWxml).toContain('setup visits = 0')
      expect(storeBeforeWxml).toContain('options count = 0')
      expect(storeBeforeWxml).toContain('options doubled = 0')
      expect(storeBeforeWxml).toContain('options label = zero')
      expect(storeBeforeWxml).toContain('options items = 0')
      expect(storeBeforeWxml).toContain('subscribe count = 0')
      expect(storeBeforeWxml).toContain('subscribe last = none')
      expect(storeBeforeWxml).toContain('action before/after/error = 0/0/0')
      expect(storeBeforeWxml).toContain('action last = none')
      expect(storeBeforeWxml).toContain('featureSetupCounter')
      expect(storeBeforeWxml).toContain('featureOptionsCounter')
      expect(storeSetupBeforeClass).toContain('use-store-page__line')
      expect(storeOptionsBeforeClass).toContain('use-store-page__line')

      const storeSetupIncOk = await tapControlUntil(storePage, '#store-setup-inc', async () => {
        const wxml = await readPageWxml(storePage)
        return wxml.includes('setup count = 1')
      })
      expect(storeSetupIncOk).toBe(true)

      const storeSetupVisitOk = await tapControlUntil(storePage, '#store-setup-visit', async () => {
        const wxml = await readPageWxml(storePage)
        return wxml.includes('setup visits = 1')
      })
      expect(storeSetupVisitOk).toBe(true)

      const storeSetupRenameOk = await tapControlUntil(storePage, '#store-setup-rename', async () => {
        const wxml = await readPageWxml(storePage)
        return wxml.includes('setup label = setup-alpha')
      })
      expect(storeSetupRenameOk).toBe(true)

      const storeSetupPatchObjectOk = await tapControlUntil(storePage, '#store-setup-patch-object', async () => {
        const wxml = await readPageWxml(storePage)
        return wxml.includes('subscribe last = setup:patch object')
      })
      expect(storeSetupPatchObjectOk).toBe(true)

      const storeSetupPatchFnOk = await tapControlUntil(storePage, '#store-setup-patch-fn', async () => {
        const wxml = await readPageWxml(storePage)
        return wxml.includes('subscribe last = setup:patch function')
      })
      expect(storeSetupPatchFnOk).toBe(true)

      const storeSetupRefWriteOk = await tapControlUntil(storePage, '#store-setup-ref-write', async () => {
        const wxml = await readPageWxml(storePage)
        return wxml.includes('setup count = 4')
      })
      expect(storeSetupRefWriteOk).toBe(true)

      const storeOptionsIncOk = await tapControlUntil(storePage, '#store-options-inc', async () => {
        const wxml = await readPageWxml(storePage)
        return wxml.includes('options count = 1')
          && wxml.includes('options items = 1')
      })
      expect(storeOptionsIncOk).toBe(true)

      const storeOptionsRenameOk = await tapControlUntil(storePage, '#store-options-rename', async () => {
        const wxml = await readPageWxml(storePage)
        return wxml.includes('options label = options-beta')
      })
      expect(storeOptionsRenameOk).toBe(true)

      const storeOptionsPatchObjectOk = await tapControlUntil(storePage, '#store-options-patch-object', async () => {
        const wxml = await readPageWxml(storePage)
        return wxml.includes('options label = options-patched')
      })
      expect(storeOptionsPatchObjectOk).toBe(true)

      const storeOptionsPatchFnOk = await tapControlUntil(storePage, '#store-options-patch-fn', async () => {
        const wxml = await readPageWxml(storePage)
        return wxml.includes('options count = 3')
      })
      expect(storeOptionsPatchFnOk).toBe(true)

      const storeOptionsRefWriteOk = await tapControlUntil(storePage, '#store-options-ref-write', async () => {
        const wxml = await readPageWxml(storePage)
        return wxml.includes('options count = 7')
      })
      expect(storeOptionsRefWriteOk).toBe(true)

      const storeSetupResetOk = await tapControlUntil(storePage, '#store-setup-reset', async () => {
        const wxml = await readPageWxml(storePage)
        return wxml.includes('setup count = 0')
          && wxml.includes('setup label = init')
          && wxml.includes('setup visits = 0')
      })
      expect(storeSetupResetOk).toBe(true)

      const storeOptionsResetOk = await tapControlUntil(storePage, '#store-options-reset', async () => {
        const wxml = await readPageWxml(storePage)
        return wxml.includes('options count = 0')
          && wxml.includes('options label = zero')
          && wxml.includes('options items = 0')
      })
      expect(storeOptionsResetOk).toBe(true)

      const storeResult = await storePage.callMethod('runE2E')
      expect(storeResult?.ok, JSON.stringify(storeResult)).toBe(true)
      expect(storeResult?.checks?.setupCount).toBe(true)
      expect(storeResult?.checks?.setupLabel).toBe(true)
      expect(storeResult?.checks?.setupVisits).toBe(true)
      expect(storeResult?.checks?.setupPatched).toBe(true)
      expect(storeResult?.checks?.optionsCount).toBe(true)
      expect(storeResult?.checks?.optionsLabel).toBe(true)
      expect(storeResult?.checks?.optionsItems).toBe(true)
      expect(storeResult?.checks?.setupResetCount).toBe(true)
      expect(storeResult?.checks?.setupResetLabel).toBe(true)
      expect(storeResult?.checks?.setupResetVisits).toBe(true)
      expect(storeResult?.checks?.optionsResetCount).toBe(true)
      expect(storeResult?.checks?.optionsResetLabel).toBe(true)
      expect(storeResult?.checks?.pluginTouched).toBe(true)
      expect(storeResult?.checks?.subscribeTriggered).toBe(true)
      expect(storeResult?.checks?.actionTriggered).toBe(true)
      expect(storeResult?.details?.subscribeEventCount).toBeGreaterThan(0)
      expect(storeResult?.details?.actionBeforeCount).toBeGreaterThan(0)
      expect(storeResult?.details?.actionAfterCount).toBeGreaterThan(0)
      expect(storeResult?.details?.actionErrorCount).toBe(0)
    }
    finally {
      await miniProgram.close()
    }
  })
})
