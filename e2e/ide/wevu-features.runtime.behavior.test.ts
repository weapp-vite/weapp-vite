import { afterAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  releaseSharedMiniProgram,
} from './wevu-features.runtime.shared'

interface SharedRuntimeSession {
  miniProgram: any
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function reconnectSession(session: SharedRuntimeSession, route: string, operation: string, error: unknown) {
  process.stdout.write(`[wevu-features:session-retry] route=${route} operation=${operation} attempt=2/2 error=${formatError(error)}\n`)
  await closeSharedMiniProgram()
  session.miniProgram = await getSharedMiniProgram()
}

async function launchPage(session: SharedRuntimeSession, route: string) {
  let lastError: unknown
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const page = await session.miniProgram.reLaunch(route)
      if (!page) {
        throw new Error(`Failed to launch page: ${route}`)
      }
      if (typeof page.waitFor === 'function') {
        await page.waitFor(300)
      }
      return page
    }
    catch (error) {
      lastError = error
      if (attempt === 2) {
        break
      }
      await reconnectSession(session, route, 'reLaunch', error)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(formatError(lastError))
}

async function runPageE2E(session: SharedRuntimeSession, page: any, method = 'runE2E') {
  let currentPage = page
  let result: any
  let lastError: unknown
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      result = await currentPage.callMethodWithOptions(method, {
        routeOnly: true,
        timeout: 60_000,
      })
      lastError = undefined
    }
    catch (error) {
      lastError = error
    }
    if (result?.ok === true) {
      return result
    }
    if (attempt === 2) {
      break
    }

    const route = String(currentPage?.path ?? '')
    if (!route) {
      break
    }
    await reconnectSession(session, route, method, lastError ?? result)
    currentPage = await launchPage(session, route)
  }
  if (lastError) {
    throw lastError
  }
  expect(result?.ok, JSON.stringify(result)).toBe(true)
  return result
}

describe.sequential('e2e app: wevu-features / behavior', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('updates runtime attrs state through page methods', async () => {
    const session = { miniProgram: await getSharedMiniProgram() }

    try {
      const page = await launchPage(session, '/pages/use-attrs/index')
      const result = await runPageE2E(session, page)

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
      await releaseSharedMiniProgram(session.miniProgram)
    }
  })

  it('updates runtime slots, model, provide/inject, store and native->vue interop pages', async () => {
    const session = { miniProgram: await getSharedMiniProgram() }

    try {
      const slotsPage = await launchPage(session, '/pages/use-slots/index')
      const slotsResult = await runPageE2E(session, slotsPage)
      expect(slotsResult?.checks?.openChanged).toBe(true)
      expect(slotsResult?.checks?.headerChanged).toBe(true)
      expect(slotsResult?.checks?.countChanged).toBe(true)

      const modelPage = await launchPage(session, '/pages/use-model/index')
      const modelResult = await runPageE2E(session, modelPage)
      expect(modelResult?.checks?.valueChanged).toBe(true)
      expect(modelResult?.checks?.logsChanged).toBe(true)
      expect(modelResult?.state?.value).toBe('alpha-from-parent')
      expect(modelResult?.state?.title).toBe('组件内 useModel()')

      const nullGuardResult = await runPageE2E(session, modelPage, 'runNullGuardE2E')
      expect(nullGuardResult?.safeValue).toBe('')
      expect(nullGuardResult?.rawValue).toBe('')
      expect(nullGuardResult?.hasNullLiteral).toBe(false)

      const provideInjectPage = await launchPage(session, '/pages/use-provide-inject/index')
      const provideInjectResult = await runPageE2E(session, provideInjectPage)
      expect(provideInjectResult?.checks?.countChanged).toBe(true)
      expect(provideInjectResult?.checks?.themeChanged).toBe(true)
      expect(provideInjectResult?.checks?.actionChanged).toBe(true)
      expect(provideInjectResult?.state?.lastAction).toBe('theme:provider')

      const provideInjectScopePage = await launchPage(session, '/pages/use-provide-inject-scope/index')
      const provideInjectScopeResult = await runPageE2E(session, provideInjectScopePage)
      expect(provideInjectScopeResult?.checks?.appInstance).toBe(true)
      expect(provideInjectScopeResult?.checks?.appSetup).toBe(true)
      expect(provideInjectScopeResult?.checks?.pageProvide).toBe(true)
      expect(provideInjectScopeResult?.state?.pageValue).toBe('page-provide-value')

      const storePage = await launchPage(session, '/pages/use-store/index')
      const storeResult = await runPageE2E(session, storePage)
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

      const nativeUsesVuePage = await launchPage(session, '/pages/native-uses-vue/index')
      const nativeResult = await runPageE2E(session, nativeUsesVuePage)
      expect(nativeResult?.checks?.modeChanged).toBe(true)
      expect(nativeResult?.checks?.countChanged).toBe(true)
      expect(nativeResult?.state?.mode).toBe('contrast')
      expect(nativeResult?.state?.count).toBe(2)
    }
    finally {
      await releaseSharedMiniProgram(session.miniProgram)
    }
  })
})
