import { afterAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  releaseSharedMiniProgram,
} from './wevu-features.runtime.shared'

async function launchPage(miniProgram: any, route: string) {
  const page = await miniProgram.reLaunch(route)
  if (!page) {
    throw new Error(`Failed to launch page: ${route}`)
  }
  if (typeof page.waitFor === 'function') {
    await page.waitFor(300)
  }
  return page
}

async function runPageE2E(page: any, method = 'runE2E') {
  const result = await page.callMethod(method)
  expect(result?.ok, JSON.stringify(result)).toBe(true)
  return result
}

describe.sequential('e2e app: wevu-features / behavior', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('updates runtime attrs state through page methods', async () => {
    const miniProgram = await getSharedMiniProgram()

    try {
      const page = await launchPage(miniProgram, '/pages/use-attrs/index')
      const result = await runPageE2E(page)

      expect(result?.checks?.toneChanged).toBe(true)
      expect(result?.checks?.visibleChanged).toBe(true)
      expect(result?.checks?.borderChanged).toBe(true)
      expect(result?.checks?.seedChanged).toBe(true)
      expect(result?.state?.toneClass).toBe('tone-green')
      expect(result?.state?.visible).toBe(false)
      expect(result?.state?.strongBorder).toBe(true)
      expect(result?.state?.extraLabel).toBe('seed-2')
      expect(result?.state?.badgeStyle).toContain('solid')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('updates runtime slots, model, provide/inject, store and native->vue interop pages', async () => {
    const miniProgram = await getSharedMiniProgram()

    try {
      const slotsPage = await launchPage(miniProgram, '/pages/use-slots/index')
      const slotsResult = await runPageE2E(slotsPage)
      expect(slotsResult?.checks?.openChanged).toBe(true)
      expect(slotsResult?.checks?.headerChanged).toBe(true)
      expect(slotsResult?.checks?.countChanged).toBe(true)

      const modelPage = await launchPage(miniProgram, '/pages/use-model/index')
      const modelResult = await runPageE2E(modelPage)
      expect(modelResult?.checks?.valueChanged).toBe(true)
      expect(modelResult?.checks?.logsChanged).toBe(true)
      expect(modelResult?.state?.value).toBe('alpha-from-parent')
      expect(modelResult?.state?.title).toBe('组件内 useModel()')

      const nullGuardResult = await runPageE2E(modelPage, 'runNullGuardE2E')
      expect(nullGuardResult?.safeValue).toBe('')
      expect(nullGuardResult?.rawValue).toBe('')
      expect(nullGuardResult?.hasNullLiteral).toBe(false)

      const provideInjectPage = await launchPage(miniProgram, '/pages/use-provide-inject/index')
      const provideInjectResult = await runPageE2E(provideInjectPage)
      expect(provideInjectResult?.checks?.countChanged).toBe(true)
      expect(provideInjectResult?.checks?.themeChanged).toBe(true)
      expect(provideInjectResult?.checks?.actionChanged).toBe(true)
      expect(provideInjectResult?.state?.lastAction).toBe('theme:provider')

      const provideInjectScopePage = await launchPage(miniProgram, '/pages/use-provide-inject-scope/index')
      const provideInjectScopeResult = await runPageE2E(provideInjectScopePage)
      expect(provideInjectScopeResult?.checks?.appInstance).toBe(true)
      expect(provideInjectScopeResult?.checks?.appSetup).toBe(true)
      expect(provideInjectScopeResult?.checks?.pageProvide).toBe(true)
      expect(provideInjectScopeResult?.state?.pageValue).toBe('page-provide-value')

      const storePage = await launchPage(miniProgram, '/pages/use-store/index')
      const storeResult = await runPageE2E(storePage)
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

      const nativeUsesVuePage = await launchPage(miniProgram, '/pages/native-uses-vue/index')
      const nativeResult = await runPageE2E(nativeUsesVuePage)
      expect(nativeResult?.checks?.modeChanged).toBe(true)
      expect(nativeResult?.checks?.countChanged).toBe(true)
      expect(nativeResult?.state?.mode).toBe('contrast')
      expect(nativeResult?.state?.count).toBe(2)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
