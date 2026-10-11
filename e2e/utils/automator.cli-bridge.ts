import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies
import { getCancelSignal } from 'execa'
import { AutomatorLaunchLifecycle } from './automatorLaunchLifecycle'
import { resolveWechatCliPath } from './devtoolsCli'
import { startManagedAutomatorBridge } from './managedAutomatorBridge'

interface AutomatorCliBridgePayload {
  projectPath?: string
  cliPath?: string
  cwd?: string
  timeout?: number
  trustProject?: boolean
  args?: string[]
  projectConfig?: Record<string, any>
}

interface WaitForSocketReadyResult {
  port: number
  servicePort?: number
}

interface WaitForSocketReadyOptions {
  child?: ChildProcessWithoutNullStreams
  onSuccessfulCliExit?: (servicePort: number, signal: AbortSignal) => Promise<number | undefined>
  signal?: AbortSignal
  timeoutMs: number
  port: number
  successfulCliExitSettleMs?: number
}

interface EnableAutomatorViaHttpOptions {
  signal?: AbortSignal
  args?: string[]
  autoPort: number
  projectPath: string
  servicePort: number
  trustProject?: boolean
}

interface ResolvedCliSpawnOptions {
  args: string[]
  command: string
  options: {
    cwd?: string
    detached?: boolean
    stdio: ['ignore', 'pipe', 'pipe']
    windowsHide?: boolean
    windowsVerbatimArguments?: boolean
  }
}

const FATAL_CLI_EARLY_EXIT_PATTERNS = [
  /ERR_INVALID_ARG_TYPE/i,
  /The ["']path["'] argument must be of type string/i,
  /Missing projectPath/i,
  /Failed to read project config/i,
  /code\s*[:=]\s*10/i,
  /需要重新登录/,
  /need\s+re-?login/i,
  /re-?login/i,
]
const WINDOWS_BATCH_CLI_RE = /\.(?:bat|cmd)$/i
const WECHAT_DEVTOOLS_SERVICE_PORT_RE = /listening\s+on\s+http:\/\/127\.0\.0\.1:(\d{2,5})/i

function summarizeTextOutput(value: string | undefined, maxLength = 400) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) {
    return ''
  }
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength)}...`
}

function formatCliExitDetails(options: {
  cliPath: string
  exitCode: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
}) {
  const { cliPath, exitCode, signal, stdout, stderr } = options
  const parts = [
    `WeChat DevTools CLI exited before automator socket was ready: ${cliPath}`,
  ]

  if (typeof exitCode === 'number') {
    parts.push(`exitCode=${exitCode}`)
  }
  if (signal) {
    parts.push(`signal=${signal}`)
  }

  const stderrText = summarizeTextOutput(stderr)
  const stdoutText = summarizeTextOutput(stdout)
  if (stderrText) {
    parts.push(`stderr=${stderrText}`)
  }
  if (stdoutText) {
    parts.push(`stdout=${stdoutText}`)
  }

  return parts.join(' | ')
}

function shouldFailFastOnCliExit(options: {
  exitCode: number | null
  stdout: string
  stderr: string
}) {
  const { exitCode, stdout, stderr } = options
  if (typeof exitCode === 'number' && exitCode !== 0) {
    return true
  }

  const combined = `${stderr}\n${stdout}`
  return FATAL_CLI_EARLY_EXIT_PATTERNS.some(pattern => pattern.test(combined))
}

export function extractWechatDevtoolsServicePort(output: string) {
  const match = output.match(WECHAT_DEVTOOLS_SERVICE_PORT_RE)
  if (!match) {
    return undefined
  }

  const port = Number.parseInt(match[1]!, 10)
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : undefined
}

function readCliArgument(args: string[] | undefined, names: string[]) {
  if (!args?.length) {
    return undefined
  }
  const index = args.findIndex(arg => names.includes(arg))
  return index >= 0 ? args[index + 1] : undefined
}

export async function enableAutomatorViaHttp(options: EnableAutomatorViaHttpOptions) {
  const endpoint = new URL('/auto', `http://127.0.0.1:${options.servicePort}`)
  endpoint.searchParams.set('project', options.projectPath)
  endpoint.searchParams.set('port', String(options.autoPort))
  endpoint.searchParams.set('autoPort', String(options.autoPort))

  const account = readCliArgument(options.args, ['--auto-account', '--autoAccount'])
  if (account) {
    endpoint.searchParams.set('account', account)
  }
  const ticket = readCliArgument(options.args, ['--ticket', '--test-ticket'])
  if (ticket) {
    endpoint.searchParams.set('ticket', ticket)
  }
  if (options.trustProject) {
    endpoint.searchParams.set('trustProject', 'true')
  }

  const response = await fetch(endpoint, {
    redirect: 'follow',
    signal: options.signal,
  })
  const body = await response.text()
  if (!response.ok) {
    throw new Error(`WeChat DevTools HTTP automator fallback failed with status ${response.status}`)
  }
  let result: unknown
  try {
    result = JSON.parse(body) as unknown
  }
  catch {
    throw new Error('WeChat DevTools HTTP automator fallback returned invalid JSON')
  }
  if (result && typeof result === 'object' && 'autoPort' in result) {
    const autoPort = Number(result.autoPort)
    if (!Number.isInteger(autoPort) || autoPort <= 0 || autoPort > 65535) {
      throw new Error('WeChat DevTools HTTP automator fallback returned invalid autoPort')
    }
    return autoPort
  }

  if (typeof result === 'string' && (/^s\d+$/.test(result) || /^[0-9a-f]{32}$/i.test(result))) {
    return options.autoPort
  }

  throw new Error('WeChat DevTools HTTP automator fallback returned unsupported response')
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

export function resolveBootstrapCliArgs(args: string[]) {
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

function mergeProjectConfig(base: Record<string, any>, patch: Record<string, any>) {
  for (const [key, value] of Object.entries(patch)) {
    if (Array.isArray(value)) {
      base[key] = value.slice()
      continue
    }
    if (value && typeof value === 'object') {
      const current = base[key]
      base[key] = mergeProjectConfig(
        current && typeof current === 'object' && !Array.isArray(current) ? { ...current } : {},
        value as Record<string, any>,
      )
      continue
    }
    base[key] = value
  }
  return base
}

function readJsonDocument(filePath: string) {
  try {
    const source = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(source)
    if (!parsed || typeof parsed !== 'object') {
      return undefined
    }
    return {
      parsed: parsed as Record<string, any>,
      source,
      hasTrailingNewline: /\r?\n$/.test(source),
    }
  }
  catch {
    return undefined
  }
}

function stringifyJsonDocument(value: Record<string, any>, options: { trailingNewline: boolean }) {
  const source = JSON.stringify(value, null, 2)
  return options.trailingNewline ? `${source}\n` : source
}

function shouldUseWindowsCommandShell(cliPath: string) {
  return process.platform === 'win32' && WINDOWS_BATCH_CLI_RE.test(cliPath)
}

function escapeWindowsCmdArg(arg: string) {
  const escaped = arg
    .replace(/"/g, '""')
    .replace(/%/g, '%%')
  return /[\s"&<>^|()]/.test(arg) ? `"${escaped}"` : escaped
}

export function resolveCliSpawnOptions(cliPath: string, args: string[], cwd?: string): ResolvedCliSpawnOptions {
  if (shouldUseWindowsCommandShell(cliPath)) {
    const comspec = process.env.ComSpec || 'cmd.exe'
    const commandLine = [cliPath, ...args]
      .map(escapeWindowsCmdArg)
      .join(' ')

    return {
      command: comspec,
      args: ['/d', '/s', '/c', `"${commandLine}"`],
      options: {
        cwd,
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        windowsVerbatimArguments: true,
      },
    }
  }

  return {
    command: cliPath,
    args,
    options: {
      cwd,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  }
}

async function reserveLoopbackPort() {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve(port)
      })
    })
  })
}

async function pollForSocketReady(options: WaitForSocketReadyOptions, lifecycle: AutomatorLaunchLifecycle): Promise<WaitForSocketReadyResult> {
  const { child, onSuccessfulCliExit, timeoutMs, port, successfulCliExitSettleMs = 0 } = options
  const startedAt = Date.now()
  let lastError: unknown
  let targetPort = port
  let successfulExitHandled = false
  const childState: {
    spawnError: Error | null
    exit: { at: number, exitCode: number | null, signal: NodeJS.Signals | null } | null
  } = { spawnError: null, exit: null }
  const stdoutChunks: Buffer[] = []
  const stderrChunks: Buffer[] = []

  function collectStdout(chunk: Buffer) {
    stdoutChunks.push(Buffer.from(chunk))
  }
  function collectStderr(chunk: Buffer) {
    stderrChunks.push(Buffer.from(chunk))
  }

  if (child?.stdout) {
    child.stdout.on('data', collectStdout)
  }
  if (child?.stderr) {
    child.stderr.on('data', collectStderr)
  }

  const getStdout = () => Buffer.concat(stdoutChunks).toString('utf8')
  const getStderr = () => Buffer.concat(stderrChunks).toString('utf8')
  if (child) {
    child.once('exit', (exitCode, signal) => {
      childState.exit = { at: Date.now(), exitCode, signal }
    })
    child.once('error', (error) => {
      childState.spawnError = error instanceof Error ? error : new Error(String(error))
    })
  }

  while (Date.now() - startedAt <= timeoutMs) {
    lifecycle.throwIfAborted()
    if (child && childState.spawnError) {
      throw new Error(`Failed to spawn WeChat DevTools CLI: ${child.spawnfile}`, {
        cause: childState.spawnError,
      })
    }

    if (child && childState.exit && shouldFailFastOnCliExit({
      exitCode: childState.exit.exitCode,
      stdout: getStdout(),
      stderr: getStderr(),
    })) {
      throw new Error(formatCliExitDetails({
        cliPath: child.spawnfile,
        exitCode: childState.exit.exitCode,
        signal: childState.exit.signal,
        stdout: getStdout(),
        stderr: getStderr(),
      }))
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection({
          host: '127.0.0.1',
          port: targetPort,
        })
        let onAbort = () => {}
        const finish = (error?: unknown) => {
          lifecycle.signal.removeEventListener('abort', onAbort)
          socket.removeAllListeners('connect')
          socket.removeAllListeners('error')
          socket.destroy()
          if (error) {
            reject(error)
          }
          else {
            resolve()
          }
        }
        onAbort = () => finish(lifecycle.signal.reason)
        function onConnect() {
          finish()
        }
        function onError(error: Error) {
          finish(error)
        }
        lifecycle.signal.addEventListener('abort', onAbort, { once: true })
        socket.once('connect', onConnect)
        socket.once('error', onError)
      })
      return {
        port: targetPort,
        servicePort: extractWechatDevtoolsServicePort(`${getStdout()}\n${getStderr()}`),
      }
    }
    catch (error) {
      lifecycle.throwIfAborted()
      lastError = error
    }

    if (
      childState.exit?.exitCode === 0
      && !childState.exit.signal
      && !successfulExitHandled
      && onSuccessfulCliExit
    ) {
      const servicePort = extractWechatDevtoolsServicePort(`${getStdout()}\n${getStderr()}`)
      if (servicePort) {
        const settleRemaining = successfulCliExitSettleMs - (Date.now() - childState.exit.at)
        if (settleRemaining > 0) {
          await lifecycle.pause(Math.min(400, settleRemaining))
          continue
        }
        successfulExitHandled = true
        targetPort = await lifecycle.step(() => onSuccessfulCliExit(servicePort, lifecycle.signal)) ?? targetPort
        continue
      }
    }

    await lifecycle.pause(400)
  }

  if (childState.spawnError) {
    throw new Error(`Failed to spawn WeChat DevTools CLI: ${child?.spawnfile ?? '<unknown>'}`, {
      cause: childState.spawnError,
    })
  }

  if (child && childState.exit && shouldFailFastOnCliExit({
    exitCode: childState.exit.exitCode,
    stdout: getStdout(),
    stderr: getStderr(),
  })) {
    throw new Error(formatCliExitDetails({
      cliPath: child.spawnfile,
      exitCode: childState.exit.exitCode,
      signal: childState.exit.signal,
      stdout: getStdout(),
      stderr: getStderr(),
    }), {
      cause: lastError as Error,
    })
  }

  throw new Error(`Timed out waiting for automator socket 127.0.0.1:${targetPort}`, {
    cause: lastError as Error,
  })
}

export async function waitForSocketReady(options: WaitForSocketReadyOptions): Promise<WaitForSocketReadyResult> {
  const lifecycle = new AutomatorLaunchLifecycle(options.timeoutMs, `automator socket 127.0.0.1:${options.port}`)
  const onAbort = () => lifecycle.controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', onAbort, { once: true })
  if (options.signal?.aborted) {
    onAbort()
  }
  try {
    return await lifecycle.run(() => pollForSocketReady(options, lifecycle))
  }
  catch (error) {
    if (lifecycle.timedOut) {
      throw new Error(`Timed out waiting for automator socket 127.0.0.1:${options.port}`, { cause: error })
    }
    throw error
  }
  finally {
    options.signal?.removeEventListener('abort', onAbort)
  }
}

export async function extendProjectConfig(projectPath: string, projectConfig?: Record<string, any>) {
  if (!projectConfig || Object.keys(projectConfig).length === 0) {
    return
  }

  const configPath = path.resolve(projectPath, 'project.config.json')
  const currentDocument = readJsonDocument(configPath)
  if (!currentDocument) {
    throw new Error(`Failed to read project config: ${configPath}`)
  }

  const next = mergeProjectConfig({ ...currentDocument.parsed }, projectConfig)
  const nextSource = stringifyJsonDocument(next, {
    trailingNewline: currentDocument.hasTrailingNewline,
  })
  if (nextSource === currentDocument.source) {
    return
  }
  fs.writeFileSync(configPath, nextSource, 'utf8')
}

async function main() {
  const rawPayload = process.argv[2]
  if (!rawPayload) {
    throw new Error('Missing automator cli bridge payload')
  }

  const payload = JSON.parse(rawPayload) as AutomatorCliBridgePayload
  const projectPath = payload.projectPath
  if (!projectPath) {
    throw new Error('Missing projectPath for automator cli bridge')
  }
  const resolvedProjectPath = path.resolve(projectPath)

  await extendProjectConfig(resolvedProjectPath, payload.projectConfig)
  const autoPort = await reserveLoopbackPort()
  const cliPath = resolveWechatCliPath(payload.cliPath)
  const cancellation = new AbortController()
  const cancelSignal = process.send ? await getCancelSignal() : undefined
  const onCancel = () => cancellation.abort(cancelSignal?.reason ?? new Error('Automator cli bridge canceled'))
  cancelSignal?.addEventListener('abort', onCancel, { once: true })
  if (cancelSignal?.aborted) {
    onCancel()
  }
  process.once('SIGTERM', onCancel)
  process.once('SIGINT', onCancel)
  cancellation.signal.throwIfAborted()
  try {
    const result = await startManagedAutomatorBridge({
      projectPath: resolvedProjectPath,
      cliPath,
      port: autoPort,
      timeout: payload.timeout ?? 30_000,
      trustProject: payload.trustProject,
      signal: cancellation.signal,
    })
    process.stdout.write(JSON.stringify(result))
  }
  finally {
    cancelSignal?.removeEventListener('abort', onCancel)
    process.removeListener('SIGTERM', onCancel)
    process.removeListener('SIGINT', onCancel)
  }
}

const currentFilePath = fileURLToPath(import.meta.url)
const entryFilePath = process.argv[1] ? path.resolve(process.argv[1]) : ''

if (entryFilePath === currentFilePath) {
  main().catch((error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}
