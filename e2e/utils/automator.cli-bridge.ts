import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

interface AutomatorCliBridgePayload {
  projectPath?: string
  cliPath?: string
  cwd?: string
  timeout?: number
  trustProject?: boolean
  args?: string[]
  projectConfig?: Record<string, any>
}

interface AutomatorCliBridgeResult {
  wsEndpoint: string
  cliPid?: number
}

interface WaitForSocketReadyOptions {
  child?: ChildProcessWithoutNullStreams
  timeoutMs: number
  port: number
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
]
const WINDOWS_BATCH_CLI_RE = /\.(?:bat|cmd)$/i

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

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function isMissingProcessError(error: unknown) {
  return error instanceof Error && 'code' in error && error.code === 'ESRCH'
}

async function terminateCliProcessTree(cliPid?: number) {
  if (!cliPid || cliPid <= 0) {
    return
  }

  const signalTarget = process.platform === 'win32' ? cliPid : -cliPid
  try {
    process.kill(signalTarget, 'SIGTERM')
  }
  catch (error) {
    if (isMissingProcessError(error)) {
      return
    }
    throw error
  }

  const startedAt = Date.now()
  while (Date.now() - startedAt <= 1_500) {
    try {
      process.kill(cliPid, 0)
      await sleep(120)
    }
    catch (error) {
      if (isMissingProcessError(error)) {
        return
      }
      throw error
    }
  }

  try {
    process.kill(signalTarget, 'SIGKILL')
  }
  catch (error) {
    if (!isMissingProcessError(error)) {
      throw error
    }
  }
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

function resolveCliPath(cliPath?: string) {
  if (cliPath?.trim()) {
    return cliPath
  }
  if (process.platform === 'win32') {
    return 'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat'
  }
  return '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
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

export async function waitForSocketReady(options: WaitForSocketReadyOptions) {
  const { child, timeoutMs, port } = options
  const startedAt = Date.now()
  let lastError: unknown
  let childSpawnError: Error | null = null
  const stdoutChunks: Buffer[] = []
  const stderrChunks: Buffer[] = []

  if (child?.stdout) {
    child.stdout.on('data', chunk => stdoutChunks.push(Buffer.from(chunk)))
  }
  if (child?.stderr) {
    child.stderr.on('data', chunk => stderrChunks.push(Buffer.from(chunk)))
  }

  const getStdout = () => Buffer.concat(stdoutChunks).toString('utf8')
  const getStderr = () => Buffer.concat(stderrChunks).toString('utf8')
  let childExit: { exitCode: number | null, signal: NodeJS.Signals | null } | null = null

  if (child) {
    child.once('exit', (exitCode, signal) => {
      childExit = { exitCode, signal }
    })
    child.once('error', (error) => {
      childSpawnError = error instanceof Error ? error : new Error(String(error))
    })
  }

  while (Date.now() - startedAt <= timeoutMs) {
    if (childSpawnError) {
      throw new Error(`Failed to spawn WeChat DevTools CLI: ${child.spawnfile}`, {
        cause: childSpawnError,
      })
    }

    if (childExit && shouldFailFastOnCliExit({
      exitCode: childExit.exitCode,
      stdout: getStdout(),
      stderr: getStderr(),
    })) {
      throw new Error(formatCliExitDetails({
        cliPath: child.spawnfile,
        exitCode: childExit.exitCode,
        signal: childExit.signal,
        stdout: getStdout(),
        stderr: getStderr(),
      }))
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection({
          host: '127.0.0.1',
          port,
        })
        socket.once('connect', () => {
          socket.end()
          resolve()
        })
        socket.once('error', reject)
      })
      return
    }
    catch (error) {
      lastError = error
      await sleep(400)
    }
  }

  if (childSpawnError) {
    throw new Error(`Failed to spawn WeChat DevTools CLI: ${child?.spawnfile ?? '<unknown>'}`, {
      cause: childSpawnError,
    })
  }

  if (childExit && shouldFailFastOnCliExit({
    exitCode: childExit.exitCode,
    stdout: getStdout(),
    stderr: getStderr(),
  })) {
    throw new Error(formatCliExitDetails({
      cliPath: child.spawnfile,
      exitCode: childExit.exitCode,
      signal: childExit.signal,
      stdout: getStdout(),
      stderr: getStderr(),
    }), {
      cause: lastError as Error,
    })
  }

  throw new Error(`Timed out waiting for automator socket 127.0.0.1:${port}`, {
    cause: lastError as Error,
  })
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
  const cliPath = resolveCliPath(payload.cliPath)
  const args = [
    'auto',
    '--project',
    resolvedProjectPath,
    '--auto-port',
    String(autoPort),
    ...(payload.args || []),
  ]
  if (payload.trustProject) {
    args.push('--trust-project')
  }

  const spawnOptions = resolveCliSpawnOptions(cliPath, args, payload.cwd)
  const child = spawn(spawnOptions.command, spawnOptions.args, spawnOptions.options)
  child.unref()

  const wsEndpoint = `ws://127.0.0.1:${autoPort}`
  try {
    await waitForSocketReady({
      child,
      port: autoPort,
      timeoutMs: payload.timeout ?? 30_000,
    })
  }
  catch (error) {
    await terminateCliProcessTree(child.pid).catch(() => {})
    throw error
  }

  const result: AutomatorCliBridgeResult = {
    wsEndpoint,
    cliPid: typeof child.pid === 'number' && child.pid > 0 ? child.pid : undefined,
  }
  process.stdout.write(JSON.stringify(result))
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
