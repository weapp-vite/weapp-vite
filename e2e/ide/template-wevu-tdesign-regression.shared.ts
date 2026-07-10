const CURRENT_PAGE_PROBE_TIMEOUT = 2_000
const WARMUP_ROUTE = '/pages/index/index'
const RELAUNCH_ATTEMPTS = 2

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function normalizeRoute(route: unknown) {
  return String(route ?? '').replace(/^\/+/, '').replace(/\/+$/, '')
}

async function waitForRoute(miniProgram: any, route: string, timeoutMs = 8_000) {
  const expectedRoute = normalizeRoute(route)
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    const page = await miniProgram.currentPage({
      retries: 1,
      timeout: CURRENT_PAGE_PROBE_TIMEOUT,
    }).catch(() => null)
    if (page && normalizeRoute(page.path) === expectedRoute) {
      return page
    }
    await delay(250)
  }
  return null
}

export function createTemplateWevuTdesignRegressionLaunchOptions(projectPath: string) {
  return {
    projectPath,
    skipRelaunchPageRootCheck: true,
    warmupAnyPage: true,
    warmupAllowRelaunch: false,
    warmupRoute: WARMUP_ROUTE,
  }
}

export function isTemplateWevuTdesignRegressionPageProtocolUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Timeout in raw reLaunch')
    || message.includes('Timed out waiting route')
    || message.includes('DevTools did not respond to protocol method App.getCurrentPage')
    || message.includes('DevTools did not respond to protocol method App.getPageStack')
    || message.includes('DevTools did not respond to protocol method App.callWxMethod')
    || message.includes('Operation timed out after')
    || message.includes('Connection closed, check if wechat web DevTools is still running')
    || message.includes('Connection closed, check if wechat web devTools is still running')
    || message.includes('WebSocket is not open')
    || message.includes('socket hang up')
    || message.includes('Target closed')
}

export function createTemplateWevuTdesignRegressionSkipMessage(label: string) {
  return `当前微信开发者工具未返回 template-wevu-tdesign-regression App 页面协议，跳过 ${label} IDE runtime。`
}

export async function assertTemplateWevuTdesignRegressionPageProtocol(miniProgram: any) {
  if (typeof miniProgram.currentPage !== 'function') {
    return
  }
  await miniProgram.currentPage({
    retries: 1,
    timeout: CURRENT_PAGE_PROBE_TIMEOUT,
  })
}

export async function relaunchTemplateWevuTdesignRegressionPage(ctx: any, miniProgram: any, route: string, label: string) {
  await assertTemplateWevuTdesignRegressionPageProtocol(miniProgram).catch((error: unknown) => {
    if (isTemplateWevuTdesignRegressionPageProtocolUnavailable(error)) {
      ctx.skip(createTemplateWevuTdesignRegressionSkipMessage(label))
    }
    throw error
  })
  let lastError: unknown
  for (let attempt = 1; attempt <= RELAUNCH_ATTEMPTS; attempt += 1) {
    try {
      const page = await miniProgram.reLaunch(route)
      if (page && normalizeRoute(page.path) === normalizeRoute(route)) {
        return page
      }
    }
    catch (error) {
      lastError = error
      if (!isTemplateWevuTdesignRegressionPageProtocolUnavailable(error)) {
        throw error
      }
    }

    const currentPage = await waitForRoute(miniProgram, route)
    if (currentPage) {
      return currentPage
    }
    await delay(500)
  }

  if (lastError && isTemplateWevuTdesignRegressionPageProtocolUnavailable(lastError)) {
    ctx.skip(createTemplateWevuTdesignRegressionSkipMessage(label))
  }
  throw new Error(`Failed to launch route after ${RELAUNCH_ATTEMPTS} attempts: ${route}`)
}
