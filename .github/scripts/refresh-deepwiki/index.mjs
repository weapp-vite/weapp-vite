import { acceptedPattern, identityGate, parseIndexStatus, refreshDecision, validateMainSha } from './state.mjs'

const failed = (reason, pageState, error) => ({ status: 'failed', reason, pageState, ...(error ? { error: { name: error.name, message: error.message } } : {}) })
const blocked = (reason, pageState) => ({ status: 'blocked', reason, pageState })

export async function refreshDeepWiki({ adapter, mainSha, now = Date.now() }) {
  const sha = validateMainSha(mainSha)
  let pageState
  try {
    await adapter.navigate()
    pageState = await adapter.inspect()
    if (!Number.isInteger(pageState.httpStatus) || pageState.httpStatus < 200 || pageState.httpStatus >= 300) {
      return failed('DeepWiki navigation did not return a successful HTTP response', pageState)
    }
    // 整页认证阻断先终止；可读取的公开索引仍保留原有无需刷新的判断。
    const initialGate = identityGate(pageState)
    if (initialGate?.scope === 'page') {
      return blocked(initialGate.reason, pageState)
    }
    let row
    try {
      row = await adapter.waitForIndex(30_000)
    }
    catch (error) {
      pageState = await adapter.inspect()
      const gate = identityGate(pageState)
      return gate?.scope === 'page' ? blocked(gate.reason, pageState) : failed('Unable to observe the public DeepWiki index status within 30000ms', pageState, error)
    }
    const index = parseIndexStatus(row, now)
    const decision = refreshDecision(sha, index, now)
    if (decision.status !== 'due') {
      return { ...decision, mainSha: sha, index, pageState }
    }
    pageState = await adapter.inspect()
    const gate = identityGate(pageState)
    if (gate) {
      return { ...blocked(gate.reason, pageState), mainSha: sha, index }
    }
    if (!await adapter.hasOfficialRefreshControl()) {
      return failed('The official DeepWiki refresh control is unavailable', pageState)
    }
    await adapter.clickOfficialRefreshControl()
    await adapter.waitForRefreshResult()
    pageState = await adapter.inspect()
    const afterGate = identityGate(pageState)
    if (afterGate) {
      return { ...blocked(afterGate.reason, pageState), mainSha: sha, index }
    }
    if (!acceptedPattern.test(pageState.bodyText)) {
      return failed('DeepWiki did not confirm that the refresh request was accepted', pageState)
    }
    return { status: 'accepted', reason: 'The public refresh control accepted the request', mainSha: sha, index, pageState }
  }
  catch (error) {
    try {
      pageState = await adapter.inspect()
    }
    catch {}
    return failed(error.message, pageState, error)
  }
}

export async function runDeepWiki({ launch, createAdapter, report, mainSha, now }) {
  validateMainSha(mainSha)
  const browser = await launch()
  let operationError
  let result
  try {
    const page = await browser.newPage()
    result = await refreshDeepWiki({ adapter: createAdapter(page), mainSha, now })
    await report(result, page)
  }
  catch (error) {
    operationError = error
  }
  finally {
    try {
      await browser.close()
    }
    catch (error) {
      if (operationError) {
        operationError.cleanupError = { name: error.name, message: error.message }
      }
      else {
        operationError = error
        operationError.cleanupError = { name: error.name, message: error.message }
      }
    }
  }
  if (operationError) {
    if (result) {
      operationError.refreshResult = result
    }
    throw operationError
  }
  return result
}

export function resultExitCode(result) {
  return ['current', 'not-due', 'accepted'].includes(result.status) ? 0 : 1
}
