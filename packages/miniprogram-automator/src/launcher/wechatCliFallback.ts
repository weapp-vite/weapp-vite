const WECHAT_DEVTOOLS_SERVICE_PORT_RE = /listening\s+on\s+http:\/\/127\.0\.0\.1:(\d{2,5})/i

export function extractWechatDevtoolsServicePort(output: string) {
  const port = Number(output.match(WECHAT_DEVTOOLS_SERVICE_PORT_RE)?.[1])
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : undefined
}

export async function enableAutomatorViaHttp(options: {
  account?: string
  autoPort: number
  projectPath: string
  servicePort: number
  ticket?: string
  trustProject?: boolean
}) {
  const endpoint = new URL('/auto', `http://127.0.0.1:${options.servicePort}`)
  endpoint.searchParams.set('project', options.projectPath)
  endpoint.searchParams.set('autoPort', String(options.autoPort))
  if (options.account) {
    endpoint.searchParams.set('account', options.account)
  }
  if (options.ticket) {
    endpoint.searchParams.set('ticket', options.ticket)
  }
  if (options.trustProject) {
    endpoint.searchParams.set('trustProject', 'true')
  }

  const response = await fetch(endpoint, { redirect: 'follow' })
  const body = await response.text()
  if (!response.ok) {
    throw new Error(`WeChat DevTools HTTP automator fallback failed with status ${response.status}${body.trim() ? `: ${body.trim().slice(0, 400)}` : ''}`)
  }

  let result: unknown
  try {
    result = JSON.parse(body) as unknown
  }
  catch (error) {
    throw new Error('WeChat DevTools HTTP automator fallback returned invalid JSON', {
      cause: error as Error,
    })
  }
  if (!result || typeof result !== 'object' || !('autoPort' in result)) {
    throw new Error('WeChat DevTools HTTP automator fallback returned no autoPort')
  }
  const autoPort = Number(result.autoPort)
  if (!Number.isInteger(autoPort) || autoPort <= 0 || autoPort > 65535) {
    throw new Error(`WeChat DevTools HTTP automator fallback returned invalid autoPort: ${String(result.autoPort)}`)
  }
  return autoPort
}

const AUTOMATOR_VALUE_OPTIONS = new Set([
  '--auto-account',
  '--auto-port',
  '--autoAccount',
  '--autoPort',
  '--project',
  '--test-ticket',
  '--ticket',
])

const AUTOMATOR_FLAG_OPTIONS = new Set([
  '--trust-project',
])

export function resolveWechatDevtoolsBootstrapArgs(args: string[]) {
  const bootstrapArgs: string[] = []
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!
    if (AUTOMATOR_VALUE_OPTIONS.has(arg)) {
      index += 1
      continue
    }
    if (AUTOMATOR_FLAG_OPTIONS.has(arg) || arg === 'auto') {
      continue
    }
    bootstrapArgs.push(arg)
  }
  bootstrapArgs.push('islogin')
  return bootstrapArgs
}
