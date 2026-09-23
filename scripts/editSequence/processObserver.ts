import type { ChildProcess } from 'node:child_process'
import type { SequenceInput, SequenceObserver } from './driver'
import { fork } from 'node:child_process'
import { fileURLToPath } from 'node:url'

interface WorkerReply<T> {
  id: number
  value?: T
  error?: string
}

/** 基线使用新进程、同一文件名，既隔离全局编译缓存，也不改变路径参与的编译语义。 */
export function createProcessObserver<T>(mode: 'compiler' | 'classic' | 'stateful-experimental', root: string): SequenceObserver<T> {
  const children = new Set<ChildProcess>()
  let incremental: ChildProcess | undefined
  let requestId = 0
  const start = (role: string) => {
    const child = fork(fileURLToPath(new URL('./worker.ts', import.meta.url)), [mode, root, role], {
      execArgv: ['--import', 'tsx'],
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
    child.kill('SIGTERM')
    const timer = setTimeout(() => child.kill('SIGKILL'), 2_000)
    try {
      await exited.promise
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
        result.resolve(message.value as T)
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
    async incremental(input) {
      incremental ??= start('incremental')
      return request(incremental, input)
    },
    async fresh(input) {
      const child = start(`fresh-${requestId + 1}`)
      try {
        return await request(child, { ...input, step: 0, action: undefined })
      }
      finally {
        await stop(child)
      }
    },
    async close() {
      await Promise.all([...children].map(stop))
    },
  }
}
