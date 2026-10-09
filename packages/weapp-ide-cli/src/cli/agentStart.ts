import type { ResolvedWechatDevtoolsTarget } from '../devtoolsTarget'
import path from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { withMachineE2ELease } from '@weapp-vite/devtools-runtime'
// eslint-disable-next-line e18e/ban-dependencies -- 官方 CLI 需要跨平台参数传递、取消和超时控制。
import { execa } from 'execa'
import { assertWechatDevtoolsHost, resolveWechatDevtoolsTarget } from '../devtoolsTarget'

export interface StartWechatIdeAgentOptions {
  projectPath: string
  port: number
  cliPath?: string
  target?: ResolvedWechatDevtoolsTarget
  trustProject?: boolean
  timeout?: number
  signal?: AbortSignal
  /** 官方回执验证后先登记窗口所有权，再检查取消状态。 */
  onStarted?: (result: StartWechatIdeAgentResult) => void | Promise<void>
}

export interface StartWechatIdeAgentResult {
  autoPort: number
  openedProjectWindow: boolean
  version: string
}

/** 提取独立的完整 JSON 对象，普通日志和嵌套对象不能替代命令响应。 */
function readResponseObjects(stdout: string): Record<string, unknown>[] {
  const objects: Record<string, unknown>[] = []
  let candidate = ''
  let depth = 0
  let quoted = false
  let escaped = false
  for (const line of stripVTControlCharacters(stdout).split(/\r?\n/)) {
    if (!candidate && !/^[{[]/.test(line.trimStart())) {
      continue
    }
    candidate += `${line}\n`
    for (const char of line) {
      if (escaped) {
        escaped = false
      }
      else if (quoted && char === '\\') {
        escaped = true
      }
      else if (char === '"') {
        quoted = !quoted
      }
      else if (!quoted && (char === '{' || char === '[')) {
        depth += 1
      }
      else if (!quoted && (char === '}' || char === ']')) {
        depth -= 1
      }
    }
    if (depth > 0) {
      continue
    }
    try {
      const parsed: unknown = JSON.parse(candidate)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        objects.push(parsed as Record<string, unknown>)
      }
    }
    catch {}
    candidate = ''
    depth = 0
    quoted = false
    escaped = false
  }
  return objects
}

function parseAgentStartResponse(stdout: string, port: number): StartWechatIdeAgentResult {
  const responses = readResponseObjects(stdout).filter(value => value.command === 'agent-start')
  const response = responses[0]
  if (responses.length !== 1 || !response || response.status !== 'ok'
    || response.autoPort !== port
    || typeof response.openedProjectWindow !== 'boolean'
    || typeof response.version !== 'string' || !response.version.trim()) {
    throw Object.assign(new Error('The official WeChat DevTools agent start response is invalid or ambiguous.'), {
      code: 'WECHAT_DEVTOOLS_AGENT_START_INVALID_RESPONSE',
      stdout,
    })
  }
  return { autoPort: port, openedProjectWindow: response.openedProjectWindow, version: response.version }
}

/** 命令失败仍可能带回完整成功回执；缺失或歧义输出不能授予窗口所有权。 */
function readFailedCommandReceipt(error: unknown, port: number) {
  if (!error || typeof error !== 'object' || !('stdout' in error) || typeof error.stdout !== 'string') {
    return
  }
  try {
    return parseAgentStartResponse(error.stdout, port)
  }
  catch {
    return undefined
  }
}

/** 使用所选安装的官方 agent start，并保留其窗口复用和端口冲突语义。 */
export async function startWechatIdeAgent(options: StartWechatIdeAgentOptions): Promise<StartWechatIdeAgentResult> {
  options.signal?.throwIfAborted()
  if (!options.projectPath.trim()) {
    throw new TypeError('Agent start projectPath must not be empty.')
  }
  if (options.cliPath !== undefined && !options.cliPath.trim()) {
    throw new TypeError('Agent start cliPath must not be empty.')
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new TypeError('Agent start port must be an integer from 1 to 65535.')
  }
  const timeout = options.timeout ?? 120_000
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new TypeError('Agent start timeout must be a finite positive number.')
  }

  return await withMachineE2ELease(async () => {
    options.signal?.throwIfAborted()
    try {
      const target = await resolveWechatDevtoolsTarget({ target: options.target, cliPath: options.cliPath })
      options.signal?.throwIfAborted()
      await assertWechatDevtoolsHost(target, { signal: options.signal, timeout })
      options.signal?.throwIfAborted()
      const argv = ['agent', 'start', '--project', path.resolve(options.projectPath), '--auto-port', String(options.port)]
      if (options.trustProject === true) {
        argv.push('--trust-project')
      }
      const result = await execa(target.cliPath, argv, {
        cancelSignal: options.signal,
        timeout,
        // CLI 可能唤起共享宿主；取消只结束当前命令，项目资源由调用方登记和释放。
        killDescendants: false,
      }).catch(async (error: unknown) => {
        // stdout 已收到但进程尚未退出时，取消、超时或非零退出会让 execa 拒绝。
        // 完整回执必须先落盘，随后继续报告原命令失败，不能将其当成启动成功。
        const receipt = readFailedCommandReceipt(error, options.port)
        if (receipt) {
          try {
            await options.onStarted?.(receipt)
          }
          catch (confirmationError) {
            throw new AggregateError([error, confirmationError], 'Failed agent command receipt could not be recorded.', { cause: error })
          }
        }
        throw error
      })
      const started = parseAgentStartResponse(result.stdout, options.port)
      await options.onStarted?.(started)
      options.signal?.throwIfAborted()
      return started
    }
    catch (error) {
      options.signal?.throwIfAborted()
      throw error
    }
  })
}
