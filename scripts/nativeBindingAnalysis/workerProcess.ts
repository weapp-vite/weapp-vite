import { fork } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export interface WorkerReady {
  id: number
  kind: 'ready'
}

export type WorkerRequest<Payload extends object>
  = | (Payload & { id: number, kind: 'compile' })
    | { id: number, kind: 'close' }

export type WorkerResponse<Ready extends WorkerReady, Result>
  = | Ready
    | { id: number, kind: 'result', result: Result }
    | { id: number, kind: 'closed' }
    | { id: number, kind: 'error', message: string }

export interface WorkerProcessOptions {
  worker: URL
  args: string[]
  label: string
  env?: NodeJS.ProcessEnv
}

/** 使用当前 Node 与串行 IPC；仅释放此调用创建且尚未确认退出的子进程。 */
export async function createWorkerProcess<Payload extends object, Ready extends WorkerReady, Result>(options: WorkerProcessOptions) {
  const child = fork(fileURLToPath(options.worker), options.args, {
    execPath: process.execPath,
    execArgv: ['--import', 'tsx'],
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    env: { ...process.env, ...options.env },
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  })
  let stderr = ''
  child.stderr?.on('data', (data) => {
    stderr = `${stderr}${String(data)}`.slice(-6000)
  })
  type Response = WorkerResponse<Ready, Result>
  let pending: { id: number, accept: (value: Response) => void, reject: (error: Error) => void } | undefined
  let sequence = 0
  let terminal = false
  const exited = new Promise<void>((resolve) => {
    child.once('exit', (code, signal) => {
      terminal = true
      pending?.reject(new Error(`${options.label} exited: ${code ?? signal}; ${stderr}`))
      resolve()
    })
    child.on('error', (error) => {
      pending?.reject(error)
      if (child.pid === undefined) {
        terminal = true
        resolve()
      }
    })
  })
  child.on('message', (value: Response) => {
    if (!pending || value.id !== pending.id) {
      child.kill('SIGTERM')
      return
    }
    if (value.kind === 'error') {
      pending.reject(new Error(value.message))
    }
    else {
      pending.accept(value)
    }
  })
  const wait = (id: number, request?: WorkerRequest<Payload>) => new Promise<Response>((accept, reject) => {
    if (terminal || pending) {
      reject(new Error(`${options.label} is not available for a serial request`))
      return
    }
    let timeout: ReturnType<typeof setTimeout> | undefined
    const finish = (error?: Error, value?: Response) => {
      clearTimeout(timeout)
      pending = undefined
      if (error) {
        reject(error)
      }
      else {
        accept(value!)
      }
    }
    timeout = setTimeout(() => finish(new Error(`${options.label} request timed out`)), 120_000)
    pending = { id, accept: value => finish(undefined, value), reject: error => finish(error) }
    if (request) {
      child.send(request, (error) => {
        if (error && pending?.id === id) {
          finish(error)
        }
      })
    }
  })
  const terminate = async () => {
    if (!terminal) {
      child.kill('SIGTERM')
      const timeout = setTimeout(() => {
        if (!terminal) {
          child.kill('SIGKILL')
        }
      }, 5000)
      let deadline: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([exited, new Promise<never>((_resolve, reject) => {
          deadline = setTimeout(() => reject(new Error(`${options.label} did not confirm exit after owned-process cleanup`)), 10_000)
        })])
      }
      finally {
        clearTimeout(timeout)
        clearTimeout(deadline)
      }
    }
  }
  try {
    const ready = await wait(0)
    if (ready.kind !== 'ready') {
      throw new Error(`Expected ${options.label} startup evidence`)
    }
    return {
      ready,
      async compile(payload: Payload) {
        const id = ++sequence
        const response = await wait(id, { ...payload, id, kind: 'compile' })
        if (response.kind !== 'result') {
          throw new Error(`Expected a ${options.label} result`)
        }
        return response.result
      },
      async close() {
        try {
          if (!terminal) {
            const id = ++sequence
            const response = await wait(id, { id, kind: 'close' })
            if (response.kind !== 'closed') {
              throw new Error(`Expected clean ${options.label} shutdown`)
            }
          }
        }
        finally {
          await terminate()
        }
      },
    }
  }
  catch (error) {
    await terminate()
    throw error
  }
}
