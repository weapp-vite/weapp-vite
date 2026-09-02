import type { TutorialCommand } from './config'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import {
  cleanupChildProcessHandles,
  createChildProcess,
  formatCommand,
  tail,
  terminateProcess,
  waitForChildClose,
} from '../../scripts/project-lifecycle.mjs'

const DEFAULT_COMMAND_TIMEOUT_MS = 10 * 60 * 1000
const DEFAULT_DEV_TIMEOUT_MS = 3 * 60 * 1000

export interface CommandResult {
  durationMs: number
  stderr: string
  stdout: string
}

export interface RunCommandOptions {
  command: TutorialCommand
  cwd: string
  env?: NodeJS.ProcessEnv
  label: string
  log: (message: string) => void
  timeoutMs?: number
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  }
  catch {
    return false
  }
}

function captureStream(
  stream: NodeJS.ReadableStream | null | undefined,
  chunks: string[],
  log: (message: string) => void,
) {
  stream?.on('data', (chunk: unknown) => {
    const text = chunk.toString()
    chunks.push(text)
    log(text)
  })
}

export async function runLoggedCommand(options: RunCommandOptions): Promise<CommandResult> {
  const {
    command,
    cwd,
    env,
    label,
    log,
    timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS,
  } = options
  const stdoutChunks: string[] = []
  const stderrChunks: string[] = []
  const printableCommand = formatCommand(command.command, command.args)
  const startedAt = Date.now()
  log(`\n[${label}] ${printableCommand}\n`)

  const child = createChildProcess(command.command, command.args, {
    cwd,
    env: {
      ...process.env,
      ...env,
      CI: 'true',
    },
    stderr: 'pipe',
    stdin: 'ignore',
    stdout: 'pipe',
  })
  captureStream(child.stdout, stdoutChunks, log)
  captureStream(child.stderr, stderrChunks, log)

  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    void terminateProcess(child)
  }, timeoutMs)
  const result = await child
  clearTimeout(timeout)

  const stdout = stdoutChunks.join('')
  const stderr = stderrChunks.join('')
  if (timedOut) {
    throw new Error(`[${label}] timed out after ${timeoutMs}ms`)
  }
  if (result.exitCode !== 0) {
    throw new Error([
      `[${label}] command failed with exit code ${result.exitCode}`,
      printableCommand,
      stdout ? `stdout:\n${tail(stdout)}` : '',
      stderr ? `stderr:\n${tail(stderr)}` : '',
    ].filter(Boolean).join('\n\n'))
  }

  return {
    durationMs: Date.now() - startedAt,
    stderr,
    stdout,
  }
}

export async function waitForPaths(paths: string[], timeoutMs = DEFAULT_DEV_TIMEOUT_MS) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if ((await Promise.all(paths.map(pathExists))).every(Boolean)) {
      return Date.now() - startedAt
    }
    await delay(500)
  }
  throw new Error(`Timed out waiting for outputs: ${paths.map(file => path.basename(file)).join(', ')}`)
}

async function waitForMtimeChange(filePath: string, previousMtimeMs: number, timeoutMs: number) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      if ((await fs.stat(filePath)).mtimeMs > previousMtimeMs) {
        return Date.now() - startedAt
      }
    }
    catch {
      // The bundler may briefly replace the output file.
    }
    await delay(350)
  }
  throw new Error(`Timed out waiting for updated output: ${path.basename(filePath)}`)
}

function createSourceUpdate(filePath: string, original: string) {
  const marker = `tutorial-e2e-${Date.now()}`
  return path.extname(filePath) === '.json'
    ? `${original.trimEnd()}\n`
    : path.extname(filePath) === '.vue'
      ? original.includes('<button')
        ? original.replace('<button', `<button data-tutorial-e2e="${marker}"`)
        : `${original.trimEnd()}\n<!-- ${marker} -->\n`
      : original.includes('Hello weapp-vite')
        ? original.replace('Hello weapp-vite', `Hello weapp-vite ${marker}`)
        : `${original.trimEnd()}\n/* ${marker} */\n`
}

export interface DevCycleOptions extends RunCommandOptions {
  outputFiles: string[]
  sourceFile: string
}

export async function runDevCycle(options: DevCycleOptions) {
  const {
    command,
    cwd,
    env,
    label,
    log,
    outputFiles,
    sourceFile,
    timeoutMs = DEFAULT_DEV_TIMEOUT_MS,
  } = options
  const stdoutChunks: string[] = []
  const stderrChunks: string[] = []
  const printableCommand = formatCommand(command.command, command.args)
  log(`\n[${label}] ${printableCommand}\n`)

  const child = createChildProcess(command.command, command.args, {
    cwd,
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      ...env,
      CI: 'true',
    },
    stderr: 'pipe',
    stdin: 'ignore',
    stdout: 'pipe',
  })
  captureStream(child.stdout, stdoutChunks, log)
  captureStream(child.stderr, stderrChunks, log)

  let childSettled = false
  void child.then(() => {
    childSettled = true
  })
  const originalSource = await fs.readFile(sourceFile, 'utf8')
  try {
    const readyMs = await waitForPaths(outputFiles, timeoutMs)
    if (childSettled) {
      throw new Error(`[${label}] dev command exited before the update check`)
    }
    const observedOutput = outputFiles[0]!
    const previousMtimeMs = (await fs.stat(observedOutput)).mtimeMs
    await fs.writeFile(sourceFile, createSourceUpdate(sourceFile, originalSource), 'utf8')
    const updateMs = await waitForMtimeChange(observedOutput, previousMtimeMs, timeoutMs)
    return { readyMs, updateMs }
  }
  catch (error) {
    const stdout = tail(stdoutChunks.join(''))
    const stderr = tail(stderrChunks.join(''))
    const detail = [stdout && `stdout:\n${stdout}`, stderr && `stderr:\n${stderr}`]
      .filter(Boolean)
      .join('\n\n')
    throw new Error(`${error instanceof Error ? error.message : String(error)}${detail ? `\n\n${detail}` : ''}`)
  }
  finally {
    await fs.writeFile(sourceFile, originalSource, 'utf8')
    await terminateProcess(child)
    if (!await waitForChildClose(child)) {
      cleanupChildProcessHandles(child)
    }
  }
}
