import process from 'node:process'
import { hasNative, spawn } from 'zigpty'

interface PtyProcessOptions {
  cwd: string
  env?: NodeJS.ProcessEnv
  onData?: (data: string) => void
}

export function launchPtyProcess(file: string, args: string[], options: PtyProcessOptions) {
  if (!hasNative) {
    throw new Error('Native PTY unavailable; terminal acceptance cannot use a pipe fallback')
  }
  const env = Object.fromEntries(Object.entries(options.env ?? process.env)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
  const terminal = spawn(file, args, { cwd: options.cwd, env, cols: 120, rows: 40 })
  let output = ''
  let exitCode: number | null = null
  let closed = false
  const dataSubscription = terminal.onData((data) => {
    const text = data.toString()
    output += text
    options.onData?.(text)
  })
  const exited = terminal.exited.then((code) => {
    exitCode = code
    return code
  })

  async function waitForExit(timeoutMs: number) {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        exited,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Timeout waiting for PTY process to exit')), timeoutMs)
        }),
      ])
    }
    finally {
      clearTimeout(timer)
    }
  }

  async function waitForOutput(predicate: (output: string) => boolean, timeoutMs: number, label: string) {
    const deadline = Date.now() + timeoutMs
    while (true) {
      if (exitCode !== null) {
        throw new Error(`PTY process exited with code ${exitCode} before ${label}\n${output}`)
      }
      if (predicate(output)) {
        return
      }
      if (Date.now() >= deadline) {
        throw new Error(`Timeout waiting for ${label}\n${output}`)
      }
      await new Promise(resolve => setTimeout(resolve, 20))
    }
  }

  async function close(options: { input?: string, graceMs?: number } = {}) {
    if (closed) {
      return
    }
    try {
      if (exitCode === null && options.input) {
        terminal.write(options.input)
        await waitForExit(options.graceMs ?? 20_000).catch(() => {})
      }
      if (exitCode === null) {
        terminal.kill('SIGTERM')
        await waitForExit(1_000).catch(() => {})
      }
      if (exitCode === null) {
        terminal.kill('SIGKILL')
        await waitForExit(5_000)
      }
    }
    finally {
      terminal.close()
      dataSubscription.dispose()
      closed = true
    }
  }

  return {
    get output() { return output },
    write: (input: string) => terminal.write(input),
    waitForOutput,
    waitForExit,
    close,
  }
}
