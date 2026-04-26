import { afterAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  readClassName,
  readPageWxml,
  readStyleValue,
  relaunchPage,
  releaseSharedMiniProgram,
  resolveSelectorById,
  tapControlUntil,
} from './wevu-features.runtime.shared'

describe.sequential('e2e app: wevu-features / behavior', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('updates runtime class and style via pure click controls', async () => {
    const miniProgram = await getSharedMiniProgram()

    try {
      const page = await miniProgram.reLaunch('/pages/use-attrs/index')
      if (!page) {
        throw new Error('Failed to launch use-attrs page')
      }

      await page.waitFor(500)

      const visibleToggleSelector = await resolveSelectorById(page, 'ctrl-toggle-visible')
      const toneSelector = await resolveSelectorById(page, 'ctrl-cycle-tone')
      const borderSelector = await resolveSelectorById(page, 'ctrl-toggle-border')
      const seedSelector = await resolveSelectorById(page, 'ctrl-bump-seed')

      const beforeWxml = await readPageWxml(page)
      const beforeToneClass = await readClassName(page, toneSelector)
      const beforeVisibleClass = await readClassName(page, visibleToggleSelector)
      const beforeBorderClass = await readClassName(page, borderSelector)
      const beforeBorderStyle = await readStyleValue(page, borderSelector)

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

      const toneApplied = await tapControlUntil(page, toneSelector, async () => {
        const afterToneWxml = await readPageWxml(page)
        return afterToneWxml.includes('切换 tone：tone-green')
          && afterToneWxml.includes('state-class = tone-green')
          && afterToneWxml.includes('state-class: tone-green')
      })
      expect(toneApplied).toBe(true)
      const afterToneClass = await readClassName(page, toneSelector)
      expect(afterToneClass).toContain('tone-green')
      expect(afterToneClass).not.toBe(beforeToneClass)

      const borderApplied = await tapControlUntil(page, borderSelector, async () => {
        const afterBorderWxml = await readPageWxml(page)
        return afterBorderWxml.includes('边框模式：strong')
          && afterBorderWxml.includes('state-class = tone-green')
          && afterBorderWxml.includes('solid')
          && afterBorderWxml.includes('badge-style: border: 2rpx solid')
      })
      expect(borderApplied).toBe(true)
      const afterBorderClass = await readClassName(page, borderSelector)
      const afterBorderStyle = await readStyleValue(page, borderSelector)
      expect(afterBorderClass).toContain('ctrl-solid')
      expect(afterBorderClass).not.toContain('ctrl-dash')
      expect(afterBorderStyle).toContain('solid')
      expect(afterBorderStyle).not.toBe(beforeBorderStyle)

      const seedBumped = await tapControlUntil(page, seedSelector, async () => {
        const afterSeedWxml = await readPageWxml(page)
        return afterSeedWxml.includes('递增 seed：2') && afterSeedWxml.includes('extra-label = seed-2')
      })
      expect(seedBumped).toBe(true)

      const visibleToggled = await tapControlUntil(page, visibleToggleSelector, async () => {
        const afterVisibleWxml = await readPageWxml(page)
        return afterVisibleWxml.includes('切换 visible：false')
          && afterVisibleWxml.includes('visible = false')
          && !afterVisibleWxml.includes('id="attrs-extra"')
      })
      expect(visibleToggled).toBe(true)

      const afterVisibleClass = await readClassName(page, visibleToggleSelector)
      expect(afterVisibleClass).toContain('ctrl-off')

      const finalWxml = await readPageWxml(page)
      expect(finalWxml).toContain('visible: false')
      expect(finalWxml).not.toContain('is-on')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('updates runtime slots, model, provide/inject, store and native->vue interop pages', async () => {
    const miniProgram = await getSharedMiniProgram()

    try {
      const slotsPage = await relaunchPage(miniProgram, '/pages/use-slots/index', 'wevu useSlots 特性展示')
      if (!slotsPage) {
        throw new Error('Failed to launch use-slots page')
      }

      const slotsResult = await slotsPage.callMethod('runE2E')
      expect(slotsResult?.ok).toBe(true)
      expect(slotsResult?.checks?.openChanged).toBe(true)
      expect(slotsResult?.checks?.headerChanged).toBe(true)
      expect(slotsResult?.checks?.countChanged).toBe(true)
      const slotsWxml = await readPageWxml(slotsPage)
      expect(slotsWxml).toContain('slots: []')

      const modelPage = await relaunchPage(miniProgram, '/pages/use-model/index', 'wevu useModel 特性展示')
      if (!modelPage) {
        throw new Error('Failed to launch use-model page')
      }

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

      const nullGuardResult = await modelPage.callMethod('runNullGuardE2E')
      expect(nullGuardResult?.ok).toBe(true)
      expect(nullGuardResult?.safeValue).toBe('')
      expect(nullGuardResult?.rawValue).toBe('')
      expect(nullGuardResult?.hasNullLiteral).toBe(false)

      const nullGuardWxml = await readPageWxml(modelPage)
      expect(nullGuardWxml).not.toContain('parent modelValue = null')
      expect(nullGuardWxml).not.toContain('inner model = null')

      const provideInjectPage = await relaunchPage(miniProgram, '/pages/use-provide-inject/index', 'wevu provide / inject 特性展示')
      if (!provideInjectPage) {
        throw new Error('Failed to launch use-provide-inject page')
      }

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

      const provideInjectScopePage = await relaunchPage(miniProgram, '/pages/use-provide-inject-scope/index', 'wevu provide / inject 深层作用域复现')
      if (!provideInjectScopePage) {
        throw new Error('Failed to launch use-provide-inject-scope page')
      }

      const provideScopeWxml = await readPageWxml(provideInjectScopePage)
      expect(provideScopeWxml).toContain('page provide = page-provide-value')
      expect(provideScopeWxml).toContain('app inject = app-provide-value')
      expect(provideScopeWxml).toContain('page inject = missing-page')
      expect(provideScopeWxml).toContain('app=app-provide-value; page=missing-page')

      const storePage = await relaunchPage(miniProgram, '/pages/use-store/index', 'wevu store 特性展示')
      if (!storePage) {
        throw new Error('Failed to launch use-store page')
      }

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

      const nativeUsesVuePage = await relaunchPage(miniProgram, '/pages/native-uses-vue/index', '原生组件引入 Vue 组件')
      if (!nativeUsesVuePage) {
        throw new Error('Failed to launch native-uses-vue page')
      }

      const nativeBeforeWxml = await readPageWxml(nativeUsesVuePage)
      expect(nativeBeforeWxml).toContain('mode: basic')
      expect(nativeBeforeWxml).toContain('count: 1')
      expect(nativeBeforeWxml).toContain('native-uses-vue')
      expect(nativeBeforeWxml).toContain('native-card')
      expect(nativeBeforeWxml).toContain('is="components/native-card/index"')

      const nativeToggleOk = await tapControlUntil(nativeUsesVuePage, '#native-interop-toggle', async () => {
        const wxml = await readPageWxml(nativeUsesVuePage)
        return wxml.includes('mode: contrast')
      })
      expect(nativeToggleOk).toBe(true)

      const nativeCountOk = await tapControlUntil(nativeUsesVuePage, '#native-interop-count', async () => {
        const wxml = await readPageWxml(nativeUsesVuePage)
        return wxml.includes('count: 2')
      })
      expect(nativeCountOk).toBe(true)

      const nativeResult = await nativeUsesVuePage.callMethod('runE2E')
      expect(nativeResult?.ok).toBe(true)
      expect(nativeResult?.checks?.modeChanged).toBe(true)
      expect(nativeResult?.checks?.countChanged).toBe(true)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
