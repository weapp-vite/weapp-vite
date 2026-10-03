import type { ChildProcess } from 'node:child_process'
import type { SequenceInput, SequenceObserver } from './driver'
import type { SequenceErrorEvidence } from './errorEvidence'
import type { SequenceMeasurement } from './measurement'
import type { SequenceWorkerMessage } from './processProtocol'
import { fork } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { restoreSequenceError, serializeSequenceError } from './errorEvidence'
import { observeProcessTree } from './processTree'

interface WorkerReply<T> {
  id: number
  value?: T
  error?: SequenceErrorEvidence
  measurement?: SequenceMeasurement
}

export type SequenceProcessMode = 'compiler' | 'classic' | 'stateful-experimental' | 'weapp-modes' | 'weapp-classic' | 'weapp-stateful'

/** 基线使用新进程、同一文件名，既隔离全局编译缓存，也不改变路径参与的编译语义。 */
export function createProcessObserver<T>(mode: SequenceProcessMode, root: string, options: { resources?: boolean } = {}): SequenceObserver<T> {
  const children = new Set<ChildProcess>()
  const stopping = new WeakMap<ChildProcess, Promise<void>>()
  const cleanupTasks = new Set<Promise<void>>()
  const deliveryErrors = new WeakMap<ChildProcess, Error[]>()
  const pendingDeliveries = new WeakMap<ChildProcess, Set<Promise<void>>>()
  let closing = false
  let closed: Promise<void> | undefined
  let incremental: ChildProcess | undefined
  let requestId = 0
  let measurement: SequenceMeasurement | undefined
  const sendControl = (child: ChildProcess, message: Extract<SequenceWorkerMessage, { type: string }>, label: string, onFailure?: () => void) => {
    const delivery = Promise.withResolvers<void>()
    const deliveries = pendingDeliveries.get(child) ?? new Set<Promise<void>>()
    pendingDeliveries.set(child, deliveries)
    deliveries.add(delivery.promise)
    const delivered = (cause: unknown) => {
      if (cause) {
        const errors = deliveryErrors.get(child) ?? []
        errors.push(new Error(label, { cause }))
        deliveryErrors.set(child, errors)
        onFailure?.()
      }
      deliveries.delete(delivery.promise)
      delivery.resolve()
    }
    try {
      child.send(message, delivered)
    }
    catch (cause) {
      delivered(cause)
    }
  }
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
  const stop = (child: ChildProcess): Promise<void> => {
    const existing = stopping.get(child)
    if (existing) {
      return existing
    }
    const stopped = Promise.withResolvers<void>()
    // 先登记再发送关闭消息，fresh 的 finally 与外层 close 复用同一回收操作。
    stopping.set(child, stopped.promise)
    cleanupTasks.add(stopped.promise)
    void (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined
      const exited = Promise.withResolvers<void>()
      const onExit = () => exited.resolve()
      const deadline = Promise.withResolvers<void>()
      const isRunning = () => child.exitCode === null && child.signalCode === null
      try {
        if (isRunning() || pendingDeliveries.get(child)?.size) {
          timer = setTimeout(() => {
            if (isRunning()) {
              child.kill('SIGKILL')
            }
            deadline.resolve()
          }, 10_000)
        }
        if (isRunning()) {
          child.once('exit', onExit)
          if (child.connected) {
            // 正常关闭仍等待 worker 的当前操作；只取消明确指定的请求。
            sendControl(child, { type: 'close' }, 'Worker close request could not be delivered', () => {
              if (child.exitCode === null && child.signalCode === null) {
                child.kill('SIGTERM')
              }
            })
          }
          else {
            child.kill('SIGTERM')
          }
          await exited.promise
        }
        // IPC 回调可晚于 exit；沿用同一个关闭期限，不能提前报告传递成功。
        const deliveries = pendingDeliveries.get(child)
        if (deliveries?.size) {
          await Promise.race([Promise.all([...deliveries]), deadline.promise])
        }
        const failures = [...(deliveryErrors.get(child) ?? [])]
        if (deliveries?.size) {
          failures.push(new Error('Worker control message delivery remained unconfirmed at the close deadline'))
        }
        if (child.signalCode !== null || (child.exitCode !== null && child.exitCode !== 0)) {
          failures.push(new Error(`Edit observer ${mode} did not release its resources gracefully (exit=${child.exitCode}, signal=${child.signalCode})`))
        }
        if (failures.length === 1) {
          throw failures[0]
        }
        if (failures.length > 1) {
          throw new AggregateError(failures, 'Worker request delivery and resource cleanup failed')
        }
      }
      finally {
        clearTimeout(timer)
        child.off('exit', onExit)
        children.delete(child)
      }
    })().then(() => {
      cleanupTasks.delete(stopped.promise)
      stopped.resolve()
    }, stopped.reject)
    return stopped.promise
  }
  const request = (child: ChildProcess, input: SequenceInput): Promise<T> => {
    input.signal.throwIfAborted()
    const id = ++requestId
    const result = Promise.withResolvers<T>()
    let settled = false
    let sent = false
    const error = (cause: unknown) => {
      if (!settled) {
        settled = true
        result.reject(cause)
      }
    }
    const exit = (code: number | null) => error(new Error(`Edit observer ${mode} exited (${code})`))
    const abort = () => {
      if (settled) {
        return
      }
      const reason = input.signal.reason
      error(reason)
      if (sent) {
        sendControl(child, { type: 'cancel', id, reason: serializeSequenceError(reason) }, 'Worker request cancellation could not be delivered')
      }
    }
    const receive = (message: WorkerReply<T>) => {
      if (message.id !== id || settled) {
        return
      }
      if (message.error) {
        error(restoreSequenceError(message.error))
      }
      else {
        void (async () => {
          const nextMeasurement = message.measurement
          if (child === incremental && options.resources && nextMeasurement) {
            nextMeasurement.processTree = await observeProcessTree(child.pid!)
          }
          if (settled) {
            return
          }
          if (child === incremental) {
            measurement = nextMeasurement
          }
          settled = true
          result.resolve(message.value as T)
        })().catch(error)
      }
    }
    child.on('message', receive)
    child.once('exit', exit)
    child.once('error', error)
    input.signal.addEventListener('abort', abort, { once: true })
    if (input.signal.aborted) {
      abort()
    }
    else {
      try {
        sent = true
        child.send({ id, files: input.files, action: input.action, step: input.step } satisfies SequenceWorkerMessage, (cause) => {
          if (cause) {
            error(cause)
          }
        })
      }
      catch (cause) {
        error(cause)
      }
    }
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
      input.signal.throwIfAborted()
      if (closing) {
        throw new Error('Edit observer is closing')
      }
      incremental ??= start('incremental')
      return request(incremental, input)
    },
    async fresh(input) {
      input.signal.throwIfAborted()
      if (closing) {
        throw new Error('Edit observer is closing')
      }
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
    close() {
      closing = true
      return closed ??= (async () => {
        // bounded 可先于 fresh 的 finally 返回；已失败的回收仍须进入总关闭结果。
        const tasks = new Set([...cleanupTasks, ...[...children].map(stop)])
        const results = await Promise.allSettled([...tasks])
        const failures = results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
        if (failures.length === 1) {
          throw failures[0]
        }
        if (failures.length > 1) {
          throw new AggregateError(failures, 'Edit observer resource cleanup failed')
        }
      })()
    },
  }
}
