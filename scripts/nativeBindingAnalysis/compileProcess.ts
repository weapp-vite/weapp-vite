import type { CompileRequest, CompileResponse, CompileScenario, CompileVariant } from './compileProtocol'
import { fork } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/** 直接使用当前 Node 可执行文件与 IPC，避免 Windows shell、命令后缀和引号差异。 */
export async function createCompileProcess(variant: CompileVariant, binding: string) {
  const child = fork(fileURLToPath(new URL('./compileWorker.ts', import.meta.url)), [variant, binding], {
    execPath: process.execPath,
    execArgv: ['--import', 'tsx'],
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    env: { ...process.env, WEAPP_VITE_NATIVE: '0' },
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  })
  let stderr = ''
  child.stderr?.on('data', (data) => {
    stderr = `${stderr}${String(data)}`.slice(-6000)
  })
  let pending: { id: number, accept: (value: CompileResponse) => void, reject: (error: Error) => void } | undefined
  let sequence = 0
  let terminal = false
  const exited = new Promise<void>((resolve) => {
    child.once('exit', (code, signal) => {
      terminal = true
      pending?.reject(new Error(`Compiler ${variant} exited: ${code ?? signal}; ${stderr}`))
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
  child.on('message', (value: CompileResponse) => {
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
  const wait = (id: number, request?: CompileRequest) => new Promise<CompileResponse>((accept, reject) => {
    if (terminal || pending) {
      reject(new Error(`Compiler ${variant} is not available for a serial request`))
      return
    }
    let timeout: ReturnType<typeof setTimeout> | undefined
    const finish = (error?: Error, value?: CompileResponse) => {
      clearTimeout(timeout)
      pending = undefined
      if (error) {
        reject(error)
      }
      else {
        accept(value!)
      }
    }
    timeout = setTimeout(() => finish(new Error(`Compiler ${variant} request timed out`)), 120_000)
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
          deadline = setTimeout(() => reject(new Error(`Compiler ${variant} did not confirm exit after owned-process cleanup`)), 10_000)
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
      throw new Error('Expected compiler startup evidence')
    }
    return {
      ready,
      async compile(scenario: CompileScenario) {
        const id = ++sequence
        const response = await wait(id, { id, kind: 'compile', scenario })
        if (response.kind !== 'result') {
          throw new Error('Expected a compiler result')
        }
        return response.result
      },
      async close() {
        try {
          if (!terminal) {
            const id = ++sequence
            const response = await wait(id, { id, kind: 'close' })
            if (response.kind !== 'closed') {
              throw new Error('Expected clean compiler shutdown')
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
