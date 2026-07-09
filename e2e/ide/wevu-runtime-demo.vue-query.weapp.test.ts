import { afterAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { attachRuntimeErrorCollector } from './runtimeErrors'
import { APP_ROOT, ensureWevuRuntimeDemoBuilt } from './wevu-runtime-demo.shared'

const ROUTE = '/pages/vue-query/index'
const VUE_QUERY_STATE_STORAGE_KEY = '__weapp_vite_vue_query_state__'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForDataMatch(
  miniProgram: any,
  predicate: (snapshot: Record<string, any>) => boolean,
  timeoutMs = 15_000,
) {
  const startedAt = Date.now()
  let lastSnapshot: Record<string, any> = {}

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const snapshot = await miniProgram.callWxMethodWithOptions('getStorageSync', {
        timeout: 2_500,
      }, VUE_QUERY_STATE_STORAGE_KEY)
      lastSnapshot = snapshot
      if (snapshot && typeof snapshot === 'object' && predicate(snapshot)) {
        return snapshot
      }
    }
    catch {
    }

    await sleep(180)
  }

  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for vue-query state.\n`
    + `Last data snapshot:\n${JSON.stringify(lastSnapshot, null, 2)}`,
  )
}

async function tapButtonAt(page: any, index: number) {
  const buttons = await page.$$('button')
  if (!Array.isArray(buttons) || !buttons[index]) {
    throw new Error(`Failed to find button at index ${index}`)
  }
  await buttons[index].tap()
}

async function invokeOrTap(page: any, methodName: string, tapIndex: number, ...args: any[]) {
  try {
    return await page.callMethod(methodName, ...args)
  }
  catch {
    await tapButtonAt(page, tapIndex)
    return null
  }
}

function expectNoVueQueryRuntimeExpressionErrors(runtimeLogs: string[]) {
  expect(runtimeLogs).toEqual([])
  const joinedLogs = runtimeLogs.join('\n')
  expect(joinedLogs).not.toContain('模板运行时表达式执行失败')
  expect(joinedLogs).not.toContain('JSON.stringify(query.data')
  expect(joinedLogs).not.toContain('JSON.stringify(queryKey')
}

async function expectNoVueQueryRuntimeExpressionErrorsAfterSettled(
  page: any,
  runtimeErrors: ReturnType<typeof attachRuntimeErrorCollector>,
  marker: number,
) {
  if (typeof page?.waitFor === 'function') {
    await page.waitFor(350)
  }
  else {
    await sleep(350)
  }
  expectNoVueQueryRuntimeExpressionErrors(runtimeErrors.getSince(marker))
}

describe.sequential('wevu runtime demo vue-query (weapp e2e)', () => {
  let miniProgram: any
  let runtimeErrors: ReturnType<typeof attachRuntimeErrorCollector> | undefined

  async function getMiniProgram(ctx: { skip: (message?: string) => void }) {
    if (miniProgram) {
      return miniProgram
    }
    try {
      // 微信开发者工具 3.15.x 在 Vue App 根入口的 ESM appservice 装载阶段，
      // 会出现 `module 'app.js' is not defined`，IDE runtime 保留 CJS 真运行链路。
      await ensureWevuRuntimeDemoBuilt('cjs')
      miniProgram = await launchAutomator({
        projectPath: APP_ROOT,
      })
      runtimeErrors = attachRuntimeErrorCollector(miniProgram)
      return miniProgram
    }
    catch (error) {
      if (isDevtoolsHttpPortError(error)) {
        ctx.skip('WeChat DevTools 服务端口未开启，跳过 vue-query IDE 自动化用例。')
      }
      throw error
    }
  }

  afterAll(async () => {
    runtimeErrors?.dispose()
    if (!miniProgram) {
      return
    }
    await miniProgram.close()
  })

  it('resolves pending query and keeps query state reactive across tab switch and key rotation', async (ctx) => {
    const miniProgram = await getMiniProgram(ctx)
    if (!runtimeErrors) {
      throw new Error('Runtime error collector is not attached.')
    }
    const initialMarker = runtimeErrors.mark()
    await miniProgram.callWxMethodWithOptions('removeStorageSync', {
      timeout: 2_500,
    }, VUE_QUERY_STATE_STORAGE_KEY).catch(() => {})
    const page = await miniProgram.reLaunch(ROUTE)
    if (!page) {
      throw new Error(`Failed to launch route ${ROUTE}`)
    }

    const initialState = await waitForDataMatch(miniProgram, snapshot => (
      snapshot.selectedTab === 'overview'
      && snapshot.statusText === '数据就绪'
      && snapshot.generatedAtText
      && snapshot.generatedAtText !== '--'
      && Array.isArray(snapshot.queryKey)
      && snapshot.queryKey[0] === 'demo-query'
      && snapshot.queryKey[1] === 'overview'
      && snapshot.query?.status === 'success'
      && snapshot.query?.data?.label === '概览数据'
    ))

    expect(initialState.query.data.label).toBe('概览数据')
    await expectNoVueQueryRuntimeExpressionErrorsAfterSettled(page, runtimeErrors, initialMarker)

    const switchMarker = runtimeErrors.mark()
    await invokeOrTap(page, 'switchTab', 1, 'detail')
    const switchedState = await waitForDataMatch(miniProgram, snapshot => (
      snapshot.selectedTab === 'detail'
      && snapshot.statusText === '数据就绪'
      && Array.isArray(snapshot.queryKey)
      && snapshot.queryKey[1] === 'detail'
      && snapshot.query?.status === 'success'
      && snapshot.query?.data?.label === '详情数据'
    ))

    expect(switchedState.query.data.label).toBe('详情数据')
    await expectNoVueQueryRuntimeExpressionErrorsAfterSettled(page, runtimeErrors, switchMarker)

    const refreshMarker = runtimeErrors.mark()
    await invokeOrTap(page, 'resetCacheAndReload', 4)
    const refreshedState = await waitForDataMatch(miniProgram, snapshot => (
      snapshot.refreshSeed === 1
      && snapshot.statusText === '数据就绪'
      && Array.isArray(snapshot.queryKey)
      && snapshot.queryKey[2] === 1
      && snapshot.query?.status === 'success'
      && snapshot.query?.data?.selectedTab === 'detail'
    ))

    expect(refreshedState.queryKey[2]).toBe(1)
    expect(refreshedState.query.data.selectedTab).toBe('detail')
    await expectNoVueQueryRuntimeExpressionErrorsAfterSettled(page, runtimeErrors, refreshMarker)
  })
})
