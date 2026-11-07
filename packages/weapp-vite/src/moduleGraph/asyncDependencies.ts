import { collectRequireTokens } from '../ast'

/** 将微信异步加载声明交给辅助 Vite 图，实际小程序代码仍由主构建生成。 */
export function appendNativeAsyncImports(code: string, ast: unknown) {
  const requests = new Set(collectRequireTokens(ast).requireTokens.map(token => token.value).filter(request => request.startsWith('.')))
  return requests.size
    ? `${code}\n${Array.from(requests, request => `import(${JSON.stringify(request)});`).join('\n')}\n`
    : undefined
}
