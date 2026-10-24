import type { Buffer } from 'node:buffer'
import type { Readable } from 'node:stream'

/** stdout 一次只接收当前请求的一行；空闲阶段的任何输出都属于协议错误。 */
export function darwinInspectorLines(stdout: Readable | null, terminal: Promise<unknown>) {
  let buffer = ''
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let failure: Error | undefined
  let ended = false
  let pending: { resolve: (line: string) => void, reject: (error: Error) => void } | undefined
  function fail(error: Error) {
    failure ??= error
    pending?.reject(failure)
    pending = undefined
  }
  function receive(chunk: Buffer | string) {
    if (!pending) {
      fail(new Error('Resource sampling received unsolicited inspector output.'))
      return
    }
    try {
      buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true })
    }
    catch {
      fail(new Error('Resource sampling received invalid UTF-8 inspector output.'))
      return
    }
    if (buffer.length > 16 * 1024 * 1024) {
      fail(new Error('Resource sampling received oversized inspector output.'))
      return
    }
    const newline = buffer.indexOf('\n')
    if (newline < 0) {
      return
    }
    const receiver = pending
    pending = undefined
    const line = buffer.slice(0, newline)
    buffer = buffer.slice(newline + 1)
    if (buffer) {
      fail(new Error('Resource sampling received multiple inspector responses.'))
    }
    receiver.resolve(line)
  }
  stdout?.on('data', receive)
  void terminal.then(
    () => {
      ended = true
      try {
        decoder.decode()
      }
      catch {
        fail(new Error('Resource sampling received incomplete UTF-8 inspector output.'))
      }
      if (pending) {
        fail(new Error('Resource sampling inspector exited before completing its response.'))
      }
    },
    () => {
      ended = true
      fail(new Error('Resource sampling inspector failed before completing its response.'))
    },
  )
  return {
    async next(timeoutMs: number) {
      if (!stdout || failure || pending || ended) {
        throw failure ?? new Error('Resource sampling inspector protocol is unavailable.')
      }
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        return await new Promise<string>((resolve, reject) => {
          pending = { resolve, reject }
          timer = setTimeout(() => fail(new Error('Resource sampling exhausted its inspector response budget.')), timeoutMs)
        })
      }
      finally {
        clearTimeout(timer)
      }
    },
    assertComplete() {
      if (failure || pending || buffer) {
        throw failure ?? new Error('Resource sampling received an incomplete inspector response.')
      }
    },
    dispose() {
      stdout?.removeListener('data', receive)
    },
  }
}
