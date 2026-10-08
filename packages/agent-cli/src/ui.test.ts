import type { RenderOptions } from 'ink'
import type { InteractiveRunner } from './ui'
import { PassThrough } from 'node:stream'
import { stripVTControlCharacters } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { interactive } from './ui'

const terminal = vi.hoisted(() => ({
  input: undefined as PassThrough | undefined,
  output: undefined as PassThrough | undefined,
  frames: [] as string[],
  instances: [] as Array<ReturnType<typeof import('ink')['render']>>,
}))

vi.mock('ink', async (importOriginal) => {
  const ink = await importOriginal<typeof import('ink')>()
  return {
    ...ink,
    render: (element: Parameters<typeof ink.render>[0], options: RenderOptions) => {
      const instance = ink.render(element, {
        ...options,
        stdin: terminal.input as RenderOptions['stdin'],
        stdout: terminal.output as RenderOptions['stdout'],
        stderr: terminal.output as RenderOptions['stderr'],
        debug: true,
        patchConsole: false,
      })
      terminal.instances.push(instance)
      return instance
    },
  }
})

function output() {
  return stripVTControlCharacters(terminal.frames.join(''))
}

async function start(runner: InteractiveRunner) {
  const finished = interactive(runner, 'existing-session')
  await vi.waitFor(() => expect(output()).toContain('Describe a mini-program change.'))
  return { finished }
}

async function submit(prompt: string) {
  terminal.input!.write(prompt)
  await vi.waitFor(() => expect(output()).toContain(`› ${prompt}`))
  terminal.input!.write('\r')
}

describe('interactive Ink renderer', () => {
  beforeEach(() => {
    terminal.frames = []
    terminal.instances = []
    terminal.input = Object.assign(new PassThrough(), {
      isTTY: true,
      setRawMode: vi.fn(),
      ref: vi.fn(),
      unref: vi.fn(),
    })
    terminal.output = Object.assign(new PassThrough(), { isTTY: true, columns: 80, rows: 24 })
    terminal.output.on('data', chunk => terminal.frames.push(String(chunk)))
  })

  afterEach(() => {
    for (const instance of terminal.instances) {
      instance.unmount()
      instance.cleanup()
    }
    terminal.input?.destroy()
    terminal.output?.destroy()
  })

  it.each([['y', true], ['n', false]] as const)('renders input and resolves approval %s', async (answer, expected) => {
    let decision: boolean | undefined
    const runner = vi.fn<InteractiveRunner>(async (prompt, session, _signal, onEvent, approve) => {
      expect(prompt).toBe('change a page')
      expect(session).toBe('existing-session')
      onEvent({ version: 1, sessionId: 'next-session', sequence: 1, timestamp: '2026-10-08T00:00:00Z', type: 'text.delta', data: { text: 'Review the proposed change' } })
      decision = await approve({ kind: 'command', summary: 'Run the targeted build', fingerprint: 'targeted-build' })
      return { sessionId: 'next-session', status: 'completed', text: 'Done' }
    })
    const { finished } = await start(runner)
    await submit('change a page')
    await vi.waitFor(() => expect(output()).toContain('Allow this exact operation? [y/n]'))
    expect(output()).toContain('Review the proposed change')
    terminal.input!.write(answer)
    await vi.waitFor(() => expect(decision).toBe(expected))
    await vi.waitFor(() => expect(output()).toContain('session next-session'))
    await submit('/exit')
    await finished
    expect(runner).toHaveBeenCalledTimes(1)
    expect(terminal.input!.listenerCount('readable')).toBe(0)
  })

  it.each(['\u001B', '\u0003'])('cancels a running task with key %j and releases pending approval', async (key) => {
    let cancelled = false
    let decision: boolean | undefined
    const runner = vi.fn<InteractiveRunner>(async (_prompt, _session, signal, _onEvent, approve) => {
      signal.addEventListener('abort', () => {
        cancelled = true
      }, { once: true })
      decision = await approve({ kind: 'command', summary: 'Pending operation', fingerprint: 'pending-operation' })
      return { sessionId: 'existing-session', status: 'cancelled', text: 'Task cancelled' }
    })
    const { finished } = await start(runner)
    await submit('run a task')
    await vi.waitFor(() => expect(output()).toContain('Pending operation'))
    terminal.input!.write(key)
    await vi.waitFor(() => {
      expect(cancelled).toBe(true)
      expect(decision).toBe(false)
      expect(output()).toContain('Task cancelled')
    })
    await submit('/exit')
    await finished
    expect(runner).toHaveBeenCalledTimes(1)
    expect(terminal.input!.listenerCount('readable')).toBe(0)
  })

  it('exits on idle Ctrl+C without starting a task', async () => {
    const runner = vi.fn<InteractiveRunner>()
    const { finished } = await start(runner)
    terminal.input!.write('\u0003')
    await finished
    expect(runner).not.toHaveBeenCalled()
    expect(terminal.input!.listenerCount('readable')).toBe(0)
  })
})
