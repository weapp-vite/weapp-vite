import fs from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 查询使用有界、受持有句柄管理的子进程。
import { execa } from 'execa'
import { resolveWechatInspectionTimeout } from '../../../packages/weapp-ide-cli/src/devtoolsTarget/inspection'
import { withWindowsInspectorDirectory } from './windowsInspectorOperation'
import { readWindowsKernelInspector } from './windowsKernelArtifact'
import { canDispatchWindowsKernelQuery, closeWindowsKernelQueryScope, currentWindowsKernelQueryScope, registerWindowsKernelOperation } from './windowsKernelQueryScope'
import { traceWindowsQueryChild } from './windowsQueryChildTrace'

interface WindowsKernelQueryResult {
  stdout: string
  stderr: string
  exitCode?: number
  signal?: string
  timedOut?: boolean
}

function remaining(deadline: number): number {
  const milliseconds = Math.floor(deadline - performance.now())
  if (milliseconds <= 0) {
    throw new Error('Windows kernel inspection exceeded its deadline before dispatch.')
  }
  return milliseconds
}

/** 只取消本 worker 登记的查询，等待相同原生句柄排空后才交还清理所有权。 */
export function drainWindowsKernelQueries(reason: unknown): Promise<void> {
  return closeWindowsKernelQueryScope(currentWindowsKernelQueryScope(), reason)
}

/** 运行时只消费校验后的构建产物；每次查询独立持有进程、取消信号及临时目录。 */
export function queryWindowsKernelProcesses(pids?: readonly number[], trace = false, options: { signal?: AbortSignal } = {}): Promise<WindowsKernelQueryResult> {
  if (pids?.some(pid => !Number.isSafeInteger(pid) || pid <= 0 || pid > 0xFFFFFFFF)) {
    return Promise.reject(new TypeError('Windows process queries require positive 32-bit PIDs.'))
  }
  if (process.platform !== 'win32') {
    return Promise.reject(new Error('Windows kernel inspection is only available on Windows.'))
  }
  const scope = currentWindowsKernelQueryScope()
  if (!canDispatchWindowsKernelQuery(scope)) {
    return Promise.reject(new Error('Windows kernel query scope is closing; no new inspection was dispatched.'))
  }
  const startedMs = performance.now()
  const deadline = startedMs + resolveWechatInspectionTimeout('win32')
  const controller = new AbortController()
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal
  const args = trace ? ['--trace'] : []
  args.push(pids ? '--pids' : '--all')
  if (pids) {
    args.push(...new Set(pids.map(String)))
  }
  const settled = (async () => {
    signal.throwIfAborted()
    const image = readWindowsKernelInspector()
    let result: WindowsKernelQueryResult | undefined
    try {
      return await withWindowsInspectorDirectory(async (directory, settle) => {
        const executable = join(directory, 'snapshot.exe')
        await fs.writeFile(executable, image)
        signal.throwIfAborted()
        const subprocess = execa(executable, args, {
          stdin: 'ignore',
          timeout: remaining(deadline),
          reject: false,
          windowsHide: true,
          cancelSignal: signal,
        })
        const observation = trace ? traceWindowsQueryChild(pids ? 'identities' : 'snapshot', subprocess, startedMs) : subprocess
        result = await settle(Object.assign(observation, { nodeChildProcess: subprocess.nodeChildProcess }))
        return result
      })
    }
    catch (cleanupError) {
      if (result && result.exitCode !== 0) {
        throw new AggregateError([result, cleanupError], 'Windows kernel query and cleanup both failed.', { cause: result })
      }
      throw cleanupError
    }
  })()
  registerWindowsKernelOperation(scope, {
    cancel: () => controller.abort(new Error('Windows kernel query owner is closing.')),
    settled: settled.then((result) => {
      if (result.exitCode !== 0) {
        throw result
      }
    }),
  })
  return settled
}

/** 旧 CIM 身份只有微秒精度；原始内核时间继续单独参与父子代次核验。 */
export function windowsLegacyProcessStarted(started: string): string | undefined {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.(\d{7})Z$/.exec(started)
  if (!match) {
    return
  }
  const milliseconds = Date.parse(`${match[1]}.000Z`)
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== `${match[1]}.000Z`) {
    return
  }
  return `${match[1]}.${match[2]!.slice(0, 6)}0Z`
}
