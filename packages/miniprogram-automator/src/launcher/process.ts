import type { OperationLifecycle } from '../operation'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { isWindows } from '../internal/compat'
import { resolveWechatDevtoolsBootstrapArgs } from './wechatCliFallback'

const WINDOWS_BATCH_CLI_RE = /\.(?:bat|cmd)$/i

function shouldUseWindowsCommandShell(cliPath: string) {
  return isWindows && WINDOWS_BATCH_CLI_RE.test(cliPath)
}

function escapeWindowsCmdArg(arg: string) {
  const escaped = arg
    .replace(/"/g, '""')
    .replace(/%/g, '%%')
  return /[\s"&<>^|()]/.test(arg) ? `"${escaped}"` : escaped
}

function resolveWindowsBatchSpawn(cliPath: string, args: string[]) {
  const comspec = process.env.ComSpec || 'cmd.exe'
  const commandLine = [cliPath, ...args]
    .map(escapeWindowsCmdArg)
    .join(' ')

  return {
    file: comspec,
    args: ['/d', '/s', '/c', `"${commandLine}"`],
  }
}

/** 只持有本次 CLI 子进程句柄；退出后不通过旧 PID 查找或终止宿主。 */
export function spawnWechatCli(cliPath: string, args: string[], cwd: string, scope: OperationLifecycle) {
  scope.throwIfAborted()
  const state = { error: null as unknown, success: false, exited: false, output: '' }
  const bootstrapArgs = resolveWechatDevtoolsBootstrapArgs(args)
  const target = shouldUseWindowsCommandShell(cliPath) ? resolveWindowsBatchSpawn(cliPath, bootstrapArgs) : { file: cliPath, args: bootstrapArgs }
  const child = spawn(target.file, target.args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: cwd || undefined,
    ...(shouldUseWindowsCommandShell(cliPath) ? { windowsHide: true, windowsVerbatimArguments: true } : {}),
  })
  let released: Promise<void> | undefined
  const release = () => {
    if (!released) {
      released = new Promise<void>((resolve) => {
        if (state.exited || !child.pid || child.exitCode !== null || child.signalCode !== null) {
          resolve()
          return
        }
        child.once('close', () => resolve())
        // 明确持有的 CLI 命令不会复用其已退出 PID；不触碰手动 IDE 或其他项目。
        child.kill('SIGKILL')
      })
    }
    return released
  }
  const disown = scope.own(release, 'cli-process')
  child.on('error', (error) => {
    state.error = error
  })
  const output = (chunk: unknown) => {
    state.output = (state.output + String(chunk)).slice(-32_768)
  }
  child.stdout?.on('data', output)
  child.stderr?.on('data', output)
  child.on('exit', (code, signal) => {
    disown()
    state.exited = true
    if (code !== 0 || signal) {
      state.error = new Error(`DevTools cli exited unexpectedly with code ${code ?? 'null'}${signal ? ` and signal ${signal}` : ''}`)
    }
    else {
      state.success = true
    }
  })
  child.unref()
  return Object.assign(state, { release })
}
