import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { cleanupChildProcessHandles, createChildProcess, formatCommand, tail, terminateProcess } from '../project-lifecycle.mjs'

const MANAGER_ENTRY_NAMES = { npm: 'npm-cli.js', corepack: 'corepack.js', yarn: 'yarn.js' }

function environmentValue(env, name) {
  const key = Object.keys(env).find(key => key.toUpperCase() === name)
  return key ? env[key] : undefined
}

function resolveWindowsExecutable(command, env) {
  const extensions = path.extname(command) ? [''] : (environmentValue(env, 'PATHEXT') || '.COM;.EXE;.BAT;.CMD').split(';')
  const directories = /[/\\]/.test(command) ? [''] : (environmentValue(env, 'PATH') || '').split(';')
  for (const directory of directories) {
    const base = path.resolve(directory.replace(/^"|"$/g, ''), command)
    for (const extension of extensions) {
      // 实际 Windows 文件系统不区分扩展名大小写；两种拼写也便于平台无关的夹具覆盖。
      for (const suffix of new Set([extension.toLowerCase(), extension])) {
        const file = `${base}${suffix}`
        if (fs.statSync(file, { throwIfNoEntry: false })?.isFile()) {
          return file
        }
      }
    }
  }
  throw new Error(`Cannot resolve package manager on PATH: ${command}`)
}

/** 直接执行官方包管理器 shim 指向的 Node 入口，避免 cmd 对空格和元字符二次解释。 */
export function resolveWindowsPackageManager(command, args, env = process.env) {
  const manager = path.basename(command).replace(/\.(?:cmd|bat|exe|com)$/i, '').toLowerCase()
  const entryName = MANAGER_ENTRY_NAMES[manager]
  if (!entryName || command === process.execPath) {
    return { command, args }
  }
  const executable = resolveWindowsExecutable(command, env)
  if (/\.(?:exe|com)$/i.test(executable)) {
    return { command: executable, args }
  }
  const shim = fs.readFileSync(executable, 'utf8')
  const targets = shim.matchAll(/%(?:dp0%|~dp0)[\\/]([^"\r\n]+\.(?:mjs|cjs|js))"/gi)
  for (const match of targets) {
    const entry = path.resolve(path.dirname(executable), match[1].replaceAll('\\', path.sep))
    if (path.basename(entry) === entryName && fs.statSync(entry, { throwIfNoEntry: false })?.isFile()) {
      return { command: process.execPath, args: [entry, ...args] }
    }
  }
  throw new Error(`Cannot resolve the Node entry from the ${manager} Windows shim`)
}

export function createCommandProcess(command, args, options) {
  const invocation = process.platform === 'win32'
    ? resolveWindowsPackageManager(command, args, options.env ?? process.env)
    : { command, args }
  return createChildProcess(invocation.command, invocation.args, options)
}

export async function runCommand({ cwd, command, args, timeoutMs, label, env, quiet = false }) {
  const stdoutChunks = []
  const stderrChunks = []
  const printableCommand = formatCommand(command, args)
  if (!quiet) {
    console.log(`\n[${label}] ${printableCommand}`)
  }
  return await new Promise((resolve, reject) => {
    const child = createCommandProcess(command, args, {
      cwd,
      env: env ?? { ...process.env, CI: 'true' },
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let timedOut = false
    const timer = setTimeout(async () => {
      timedOut = true
      await terminateProcess(child)
      cleanupChildProcessHandles(child)
      reject(new Error(`[${label}] Timed out after ${timeoutMs}ms\n${printableCommand}\n${tail(stderrChunks.join(''))}`))
    }, timeoutMs)
    child.stdout.on('data', (chunk) => {
      stdoutChunks.push(chunk.toString())
      if (!quiet) {
        process.stdout.write(chunk)
      }
    })
    child.stderr.on('data', (chunk) => {
      stderrChunks.push(chunk.toString())
      if (!quiet) {
        process.stderr.write(chunk)
      }
    })
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('close', (code, signal) => {
      clearTimeout(timer)
      if (code === 0 && !timedOut) {
        resolve({ stdout: stdoutChunks.join(''), stderr: stderrChunks.join('') })
        return
      }
      reject(new Error([
        `[${label}] ${timedOut ? `Timed out after ${timeoutMs}ms` : `Command failed with code ${code} signal ${signal}`}`,
        printableCommand,
        tail(stdoutChunks.join('')),
        tail(stderrChunks.join('')),
      ].filter(Boolean).join('\n')))
    })
  })
}

export async function timedRunCommand(input) {
  const startedAt = Date.now()
  await runCommand(input)
  return Date.now() - startedAt
}
