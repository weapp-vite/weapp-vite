/** 仅匹配 issue #779 的真实 CSS 内容请求，排除只承载失效依赖的 JS 模块。 */
export function isIssue779CssContentRequest(id: string): boolean {
  const queryIndex = id.indexOf('?')
  const rawFilename = queryIndex === -1 ? id : id.slice(0, queryIndex)
  const query = new URLSearchParams(queryIndex === -1 ? '' : id.slice(queryIndex + 1))
  let filename: string
  try {
    filename = decodeURIComponent(rawFilename).replaceAll('\\', '/')
  }
  catch {
    return false
  }
  if (!filename.includes('/src/pages/issue-779/') || query.has('raw') || query.has('url') || query.has('lang.js')) {
    return false
  }
  const type = query.get('type')
  if (type !== null && type !== 'style') {
    return false
  }
  return filename.endsWith('.css') || (type === 'style' && query.has('lang.css'))
}
