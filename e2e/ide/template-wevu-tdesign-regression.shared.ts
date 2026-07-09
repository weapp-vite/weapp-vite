const CURRENT_PAGE_PROBE_TIMEOUT = 2_000
const WARMUP_ROUTE = '/pages/index/index'

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
  const page = await miniProgram.reLaunch(route).catch((error: unknown) => {
    if (isTemplateWevuTdesignRegressionPageProtocolUnavailable(error)) {
      ctx.skip(createTemplateWevuTdesignRegressionSkipMessage(label))
    }
    throw error
  })
  if (!page) {
    throw new Error(`Failed to launch route: ${route}`)
  }
  return page
}
