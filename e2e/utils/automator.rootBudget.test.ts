import { parseDocument } from 'htmlparser2'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { querySelectorAll } from '../../mpcore/packages/simulator/src/view/selectors'

vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn(), resolveReportProjectPath: () => 'fixture' }))

type AutomatorModule = typeof import('./automator')

const route = 'pages/boundary/index'
const ipcDelayMs = 40
const relaunchEnvironment = {
  WEAPP_VITE_E2E_RELUNCH_SETTLE_DELAY: '260',
  WEAPP_VITE_E2E_RELUNCH_READY_TIMEOUT: '30000',
  WEAPP_VITE_E2E_AUTOMATOR_DISABLE_RELAUNCH_CURRENT_READY: '0',
}
let originalEnvironment = new Map<string, string | undefined>()
let enhanceMiniProgramRelaunch: AutomatorModule['enhanceMiniProgramRelaunch']
let warmupMiniProgramRoute: AutomatorModule['warmupMiniProgramRoute']

function delay(timeout: number) {
  return new Promise<void>(resolve => setTimeout(resolve, timeout))
}

// 先接管拒绝，再推进假时钟；原断言仍在所有计时器排空后原样抛出。
async function runTimersAndAssert(assertion: Promise<unknown>) {
  const observedAssertion = assertion.catch(() => undefined)
  await vi.runAllTimersAsync()
  await observedAssertion
  await assertion
}

function createBudgetedPage(renderedSelectors: string[]) {
  return {
    path: route,
    waitForRendered: vi.fn(async ({ selector, timeout }: { selector?: string, timeout: number }) => {
      const matches = selector?.split(',').some(part => part.trim() === '*'
        ? renderedSelectors.length > 0
        : renderedSelectors.includes(part.trim())) ?? false
      // 缺失节点会用完查询预算，命中节点也必须等待异步协议响应。
      await delay(matches ? Math.min(ipcDelayMs, timeout) : timeout)
      if (!matches || timeout < ipcDelayMs) {
        throw new Error('Timed out waiting for rendered node')
      }
      return JSON.stringify({ selector, nodes: [{ id: 'rendered-content' }] })
    }),
    $$: vi.fn(async () => {
      await delay(ipcDelayMs)
      return []
    }),
    $: vi.fn(async () => {
      await delay(ipcDelayMs)
      return null
    }),
  }
}

function createParsedSelectorPage() {
  const root = parseDocument('<page><button id="required">ready</button></page>').children[0]!
  const query = async (selector: string) => {
    // 复用 headless 的真实解析器，让无效并集和单项都按 provider 契约拒绝。
    const nodes = querySelectorAll(root, selector)
    await delay(ipcDelayMs)
    return nodes
  }
  return {
    path: route,
    waitForRendered: vi.fn(async ({ selector }: { selector?: string, timeout: number }) => {
      const nodes = await query(selector ?? '*')
      if (nodes.length === 0) {
        throw new Error('No rendered node matches the selector')
      }
      return JSON.stringify({ selector, nodes: [{ id: 'required' }] })
    }),
    $$: vi.fn(query),
    $: vi.fn(async (selector: string) => (await query(selector))[0] ?? null),
  }
}

beforeEach(async () => {
  // 超时在导入时读取，先清除模块缓存，再以固定环境加载当前用例的实现。
  vi.resetModules()
  originalEnvironment = new Map(Object.keys(relaunchEnvironment).map(key => [key, process.env[key]]))
  for (const [key, value] of Object.entries(relaunchEnvironment)) {
    process.env[key] = value
  }
  const automator = await import('./automator')
  enhanceMiniProgramRelaunch = automator.enhanceMiniProgramRelaunch
  warmupMiniProgramRoute = automator.warmupMiniProgramRoute
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  // 只恢复本文件改过的键，包括原先不存在的值，避免触碰其他测试的环境。
  for (const [key, value] of originalEnvironment) {
    if (value === undefined) {
      delete process.env[key]
    }
    else {
      process.env[key] = value
    }
  }
  originalEnvironment.clear()
  vi.resetModules()
  vi.clearAllMocks()
})

describe('rendered root probe budget', () => {
  it.each(['button', 'text'])('accepts a %s-only page with an asynchronous protocol response', async (selector) => {
    const page = createBudgetedPage([selector])
    const rawReLaunch = vi.fn(async (_route: string) => page)
    const miniProgram = { reLaunch: rawReLaunch, currentPage: vi.fn(async () => page), close: vi.fn() }
    enhanceMiniProgramRelaunch(miniProgram, { project: 'fixture' })
    const startedAt = Date.now()
    const assertion = expect(miniProgram.reLaunch(`/${route}?force=1`)).resolves.toBe(page)

    await runTimersAndAssert(assertion)

    expect(Date.now() - startedAt).toBeLessThanOrEqual(1_500 + 260)
    expect(rawReLaunch).toHaveBeenCalledExactlyOnceWith(`/${route}?force=1`)
    expect(miniProgram.close).not.toHaveBeenCalled()
  })

  it.each(['button', 'text'])('keeps the 300 ms same-route shortcut usable for a %s-only page', async (selector) => {
    const page = createBudgetedPage([selector])
    const rawReLaunch = vi.fn(async (_route: string) => page)
    const miniProgram = { reLaunch: rawReLaunch, currentPage: vi.fn(async () => page), close: vi.fn() }
    enhanceMiniProgramRelaunch(miniProgram, { project: 'fixture' })
    const startedAt = Date.now()
    const assertion = expect(miniProgram.reLaunch(`/${route}`)).resolves.toBe(page)

    await runTimersAndAssert(assertion)

    expect(Date.now() - startedAt).toBeLessThanOrEqual(300)
    expect(rawReLaunch).not.toHaveBeenCalled()
    expect(miniProgram.close).not.toHaveBeenCalled()
  })

  it.each([false, true])('preserves any-root readiness when the first explicit selector is missing (navigate=%s)', async (navigate) => {
    const page = createBudgetedPage(['#required'])
    const rawReLaunch = vi.fn(async (_route: string) => page)
    const miniProgram = { reLaunch: rawReLaunch, currentPage: vi.fn(async () => page), close: vi.fn() }
    enhanceMiniProgramRelaunch(miniProgram, {
      project: 'fixture',
      rootSelectors: ['#missing', '#required'],
      rootSelectorsRoute: route,
    })
    const startedAt = Date.now()
    const target = `/${route}${navigate ? '?force=1' : ''}`
    const assertion = expect(miniProgram.reLaunch(target)).resolves.toBe(page)

    await runTimersAndAssert(assertion)

    expect(Date.now() - startedAt).toBeLessThanOrEqual(navigate ? 1_500 + 260 : 300)
    expect(rawReLaunch).toHaveBeenCalledTimes(navigate ? 1 : 0)
    expect(miniProgram.close).not.toHaveBeenCalled()
  })

  it.each([false, true])('keeps later valid roots usable after a malformed first selector (navigate=%s)', async (navigate) => {
    const page = createParsedSelectorPage()
    const rawReLaunch = vi.fn(async (_route: string) => page)
    const miniProgram = { reLaunch: rawReLaunch, currentPage: vi.fn(async () => page), close: vi.fn() }
    enhanceMiniProgramRelaunch(miniProgram, {
      project: 'fixture',
      rootSelectors: ['[style*=', '#required'],
      rootSelectorsRoute: route,
    })
    const startedAt = Date.now()
    const target = `/${route}${navigate ? '?force=1' : ''}`
    const assertion = expect(miniProgram.reLaunch(target)).resolves.toBe(page)

    await runTimersAndAssert(assertion)

    expect(Date.now() - startedAt).toBeLessThanOrEqual(navigate ? 1_500 + 260 : 300)
    expect(page.$$.mock.calls.map(([selector]) => selector)).toEqual(['[style*=', '#required'])
    expect(rawReLaunch).toHaveBeenCalledTimes(navigate ? 1 : 0)
    expect(miniProgram.close).not.toHaveBeenCalled()
  })

  it('preserves cancellation during a successful fallback root IPC after an invalid selector', async () => {
    const page = createParsedSelectorPage()
    const miniProgram = { reLaunch: vi.fn(async (_route: string) => page), close: vi.fn() }
    const controller = new AbortController()
    const reason = new Error('fallback readiness cancelled')
    const assertion = expect(warmupMiniProgramRoute(miniProgram, `/${route}`, 'fixture', {
      rootSelectors: ['[style*=', '#required'],
      signal: controller.signal,
    })).rejects.toBe(reason)
    setTimeout(() => controller.abort(reason), 260 + ipcDelayMs / 2)

    await runTimersAndAssert(assertion)

    expect(page.$$.mock.calls.map(([selector]) => selector)).toEqual(['[style*=', '#required'])
    expect(miniProgram.reLaunch).toHaveBeenCalledExactlyOnceWith(`/${route}`)
    expect(miniProgram.close).not.toHaveBeenCalled()
  })

  it('rejects a page when every supported root query is absent', async () => {
    const page = createBudgetedPage([])
    const rawReLaunch = vi.fn(async (_route: string) => page)
    const miniProgram = { reLaunch: rawReLaunch, currentPage: vi.fn(async () => page), close: vi.fn() }
    enhanceMiniProgramRelaunch(miniProgram, { project: 'fixture' })
    const assertion = expect(miniProgram.reLaunch(`/${route}?force=1`)).rejects.toThrow('Timed out waiting page root')

    await runTimersAndAssert(assertion)

    expect(rawReLaunch).toHaveBeenCalledOnce()
    expect(miniProgram.close).toHaveBeenCalledTimes(1)
  })

  it('does not replace an explicit missing root with generic rendered content', async () => {
    const page = createBudgetedPage(['button'])
    const rawReLaunch = vi.fn(async (_route: string) => page)
    const miniProgram = { reLaunch: rawReLaunch, currentPage: vi.fn(async () => page), close: vi.fn() }
    enhanceMiniProgramRelaunch(miniProgram, {
      project: 'fixture',
      rootSelectors: ['#required'],
      rootSelectorsRoute: route,
    })
    const assertion = expect(miniProgram.reLaunch(`/${route}?force=1`)).rejects.toThrow('Timed out waiting page root')

    await runTimersAndAssert(assertion)

    expect(page.waitForRendered.mock.calls.every(([options]) => options.selector === '#required')).toBe(true)
    expect(rawReLaunch).toHaveBeenCalledOnce()
    expect(miniProgram.close).toHaveBeenCalledTimes(1)
  })

  it('preserves cancellation while a successful rendered-root IPC is pending', async () => {
    const page = createBudgetedPage(['view'])
    const miniProgram = { reLaunch: vi.fn(async (_route: string) => page), close: vi.fn() }
    const controller = new AbortController()
    const reason = new Error('readiness cancelled')
    const assertion = expect(warmupMiniProgramRoute(miniProgram, `/${route}`, 'fixture', {
      signal: controller.signal,
    })).rejects.toBe(reason)
    // 原有 settle 为 260 ms；在命中查询的异步响应完成前取消。
    setTimeout(() => controller.abort(reason), 260 + ipcDelayMs / 2)

    await runTimersAndAssert(assertion)

    expect(miniProgram.reLaunch).toHaveBeenCalledExactlyOnceWith(`/${route}`)
    expect(miniProgram.close).not.toHaveBeenCalled()
  })

  it('does not start a probe or navigation after cancellation', async () => {
    const page = createBudgetedPage(['button'])
    const miniProgram = { reLaunch: vi.fn(async (_route: string) => page) }
    const controller = new AbortController()
    const reason = new Error('already cancelled')
    controller.abort(reason)

    await expect(warmupMiniProgramRoute(miniProgram, `/${route}`, 'fixture', {
      signal: controller.signal,
    })).rejects.toBe(reason)
    expect(page.waitForRendered).not.toHaveBeenCalled()
    expect(miniProgram.reLaunch).not.toHaveBeenCalled()
  })
})
