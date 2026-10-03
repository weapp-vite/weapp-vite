import type { ChildProcess } from 'node:child_process'
import type { SequenceInput, SequenceObserver } from './driver'
import type { SequenceMeasurement } from './measurement'
import { fork } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { observeProcessTree } from './processTree'

interface WorkerReply<T> {
  id: number
  value?: T
  error?: string
  measurement?: SequenceMeasurement
}

export type SequenceProcessMode = 'compiler' | 'classic' | 'stateful-experimental' | 'weapp-modes' | 'weapp-classic' | 'weapp-stateful'

/** 基线使用新进程、同一文件名，既隔离全局编译缓存，也不改变路径参与的编译语义。 */
export function createProcessObserver<T>(mode: SequenceProcessMode, root: string, options: { resources?: boolean } = {}): SequenceObserver<T> {
  const children = new Set<ChildProcess>()
  let incremental: ChildProcess | undefined
  let requestId = 0
  let measurement: SequenceMeasurement | undefined
  const start = (role: string) => {
    const child = fork(fileURLToPath(new URL('./worker.ts', import.meta.url)), [mode, root, role], {
      execArgv: [...(options.resources ? ['--expose-gc'] : []), '--import', 'tsx'],
      env: { ...process.env, EDIT_SEQUENCE_RESOURCE_GC: options.resources ? '1' : '0' },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      serialization: 'advanced',
    })
    children.add(child)
    return child
  }
  const stop = async (child: ChildProcess) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      children.delete(child)
      return
    }
    const exited = Promise.withResolvers<void>()
    child.once('exit', () => exited.resolve())
    if (child.connected) {
      // 正常关闭由 worker 串行回收其资源；SIGTERM 会同时触发 Vite 自己的退出监听。
      child.send({ type: 'close' }, (error) => {
        if (error && child.exitCode === null && child.signalCode === null) {
          child.kill('SIGTERM')
        }
      })
    }
    else {
      child.kill('SIGTERM')
    }
    const timer = setTimeout(() => child.kill('SIGKILL'), 10_000)
    try {
      await exited.promise
      if (child.signalCode === 'SIGKILL' || (child.exitCode !== null && child.exitCode !== 0)) {
        throw new Error(`Edit observer ${mode} did not release its resources gracefully (exit=${child.exitCode}, signal=${child.signalCode})`)
      }
    }
    finally {
      clearTimeout(timer)
      children.delete(child)
    }
  }
  const request = (child: ChildProcess, input: SequenceInput): Promise<T> => {
    const id = ++requestId
    const result = Promise.withResolvers<T>()
    const error = (cause: Error) => result.reject(cause)
    const exit = (code: number | null) => error(new Error(`Edit observer ${mode} exited (${code})`))
    const abort = () => error(input.signal.reason)
    const receive = (message: WorkerReply<T>) => {
      if (message.id !== id) {
        return
      }
      if (message.error) {
        result.reject(new Error(message.error))
      }
      else {
        void (async () => {
          if (child === incremental) {
            measurement = message.measurement
            if (options.resources && measurement) {
              measurement.processTree = await observeProcessTree(child.pid!)
            }
          }
          result.resolve(message.value as T)
        })().catch(result.reject)
      }
    }
    child.on('message', receive)
    child.once('exit', exit)
    child.once('error', error)
    input.signal.addEventListener('abort', abort, { once: true })
    child.send({ id, files: input.files, action: input.action, step: input.step }, (cause) => {
      if (cause) {
        error(cause)
      }
    })
    return result.promise.finally(() => {
      child.off('message', receive)
      child.off('exit', exit)
      child.off('error', error)
      input.signal.removeEventListener('abort', abort)
    })
  }
  return {
    name: mode,
    measure: () => measurement,
    resources: () => ({ children: children.size }),
    async incremental(input) {
      incremental ??= start('incremental')
      return request(incremental, input)
    },
    async fresh(input) {
      const child = start(`fresh-${requestId + 1}`)
      let value: T | undefined
      let failure: { error: unknown } | undefined
      try {
        value = await request(child, { ...input, step: 0, action: undefined })
      }
      catch (error) {
        failure = { error }
      }
      try {
        await stop(child)
      }
      catch (error) {
        if (failure) {
          throw new AggregateError([failure.error, error], 'Fresh observation and resource cleanup both failed')
        }
        throw error
      }
      if (failure) {
        throw failure.error
      }
      return value as T
    },
    async close() {
      await Promise.all([...children].map(stop))
    },
  }
}
