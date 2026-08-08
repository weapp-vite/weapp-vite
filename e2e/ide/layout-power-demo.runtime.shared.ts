const INDEX_ROUTE = '/pages/index/index'

export async function runLayoutFeedbackE2E(miniProgram: any, timeout = 30_000) {
  const evaluator = async (expectedRoute: string) => {
    const normalizeRoute = (value: unknown) => String(value || '')
      .split('?', 1)[0]
      .split('#', 1)[0]
      .replace(/^\/+/, '')
      .replace(/\/+$/g, '')
    const expected = normalizeRoute(expectedRoute)
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    const targetPage = pages
      .slice()
      .reverse()
      .find((item: any) => [item?.route, item?.__route__, item?.path]
        .some(value => normalizeRoute(value) === expected)) as any
    const method = targetPage?.runLayoutFeedbackE2E
    if (typeof method !== 'function') {
      return {
        missing: true,
        pages: pages.map((item: any) => item?.route || item?.__route__ || item?.path || ''),
      }
    }
    return {
      value: await method.call(targetPage),
    }
  }
  const result = typeof miniProgram.evaluateWithOptions === 'function'
    ? await miniProgram.evaluateWithOptions(evaluator, {
        timeout,
      }, INDEX_ROUTE)
    : await miniProgram.evaluate(evaluator, INDEX_ROUTE)

  if (result?.missing) {
    throw new Error(`Automator page method not ready: route=${INDEX_ROUTE} method=runLayoutFeedbackE2E pages=${(result.pages ?? []).join(',') || '<empty>'}`)
  }
  return result?.value
}
