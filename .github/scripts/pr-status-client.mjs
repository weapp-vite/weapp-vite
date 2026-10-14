import { readVerifiedPrContext } from './pr-context-provenance.mjs'
import { downloadPrContext } from './resolve-performance-runs.mjs'

async function readLog(response) {
  const decoder = new TextDecoder()
  let bytes = 0
  let result = ''
  for await (const chunk of response.body) {
    bytes += chunk.byteLength
    if (bytes > 2_097_152) {
      throw new Error('PR resolver log exceeds the reporting limit')
    }
    result += decoder.decode(chunk, { stream: true })
  }
  return result + decoder.decode()
}

/** 状态回写和历史同步共享只读取证与有界日志下载，候选代码不接触写入凭据。 */
export function createPrStatusClient({ token, repository, apiUrl = 'https://api.github.com' }) {
  const request = async (pathname, options = {}) => {
    const response = await fetch(`${apiUrl}${pathname}`, {
      method: options.method ?? 'GET',
      headers: {
        'authorization': `Bearer ${token}`,
        'accept': 'application/vnd.github+json',
        'content-type': 'application/json',
        'x-github-api-version': '2022-11-28',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) {
      throw new Error(`GitHub API ${response.status}: ${pathname}`)
    }
    return options.responseType === 'text' ? readLog(response) : response.json()
  }
  return {
    request,
    readContext: run => downloadPrContext({ apiUrl, token, repository, run, request: (_api, _token, pathname) => request(pathname) }),
    verifyContext: (run, defaultBranch) => readVerifiedPrContext({ apiUrl, token, repository, run, defaultBranch, request }),
  }
}
