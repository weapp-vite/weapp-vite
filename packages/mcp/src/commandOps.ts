import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { DEFAULT_MAX_OUTPUT_CHARS, DEFAULT_TIMEOUT_MS } from './constants'
import { resolveSubPath } from './workspace'

export interface CommandResult {
  command: string
  args: string[]
  cwd: string
  exitCode: number
  stdout: string
  stderr: string
  timedOut: boolean
}

const ALLOWED_COMMANDS = new Set([
  'pnpm',
  'node',
  'git',
  'rg',
])

function resolveExecutable(command: string) {
  if (process.platform === 'win32') {
    if (command === 'pnpm') {
      return 'pnpm.cmd'
    }
    if (command === 'git') {
      return 'git.exe'
    }
    if (command === 'rg') {
      return 'rg.exe'
    }
  }
  return command
}

function truncateOutput(text: string, maxChars: number) {
  if (text.length <= maxChars) {
    return text
  }
  return `${text.slice(0, maxChars)}\n\n[truncated: ${text.length - maxChars} chars omitted]`
}

export async function runCommand(
  workspaceRoot: string,
  command: string,
  args: string[],
  options?: {
    cwdRelative?: string
    timeoutMs?: number
    maxOutputChars?: number
  },
): Promise<CommandResult> {
  if (!ALLOWED_COMMANDS.has(command)) {
    throw new Error(`不允许的命令：${command}`)
  }

  const cwd = resolveSubPath(workspaceRoot, options?.cwdRelative ?? '.')
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxOutputChars = options?.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS
  const executable = resolveExecutable(command)

  const child = spawn(executable, args, {
    cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  })

  let stdout = ''
  let stderr = ''
  let timedOut = false

  const timer = setTimeout(() => {
    timedOut = true
    child.kill('SIGTERM')
  }, timeoutMs)

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString()
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => {
      resolve(code ?? -1)
    })
  }).finally(() => {
    clearTimeout(timer)
  })

  return {
    command,
    args,
    cwd: path.resolve(cwd),
    exitCode,
    stdout: truncateOutput(stdout.trim(), maxOutputChars),
    stderr: truncateOutput(stderr.trim(), maxOutputChars),
    timedOut,
  }
}
