import type { SessionEvent } from '@weapp-agent/core'
import type { InteractiveRunner } from '../src/ui/commands.js'
import { expect, it, vi } from 'vitest'
import { eventText } from '../src/ui.js'
import { runInteractiveTask } from '../src/ui/commands.js'

function runner() {
  return vi.fn<InteractiveRunner>(async (_prompt, sessionId) => ({
    sessionId: sessionId ?? 'new-session',
    status: 'completed',
    text: 'Done',
  }))
}

function submit(run: InteractiveRunner, prompt: string, sessionId?: string) {
  return runInteractiveTask(run, prompt, sessionId, new AbortController().signal, () => {}, async () => false)
}

it('keeps ordinary follow-up text separate from explicit recovery acknowledgement', async () => {
  const run = runner()
  await submit(run, 'I inspected the state, continue', 'saved-session')
  expect(run.mock.calls[0]?.[0]).toBe('I inspected the state, continue')
  expect(run.mock.calls[0]?.[5]).toEqual({ acknowledgeInterrupted: false })
})

it('acknowledges interrupted outcomes only for the exact interactive command', async () => {
  const run = runner()
  await submit(run, '/acknowledge-interrupted finish the remaining checks', 'saved-session')
  expect(run.mock.calls[0]?.[0]).toBe('finish the remaining checks')
  expect(run.mock.calls[0]?.[1]).toBe('saved-session')
  expect(run.mock.calls[0]?.[5]).toEqual({ acknowledgeInterrupted: true })
  await submit(run, '/acknowledge-interrupted-extra', 'saved-session')
  expect(run.mock.calls[1]?.[5]).toEqual({ acknowledgeInterrupted: false })
})

it('supports acknowledgement without a follow-up and does not carry it to later turns', async () => {
  const run = runner()
  await submit(run, '/acknowledge-interrupted', 'saved-session')
  expect(run.mock.calls[0]?.[0]).toContain('checking the current project state')
  expect(run.mock.calls[0]?.[5]).toEqual({ acknowledgeInterrupted: true })
  await submit(run, 'continue', 'saved-session')
  expect(run.mock.calls[1]?.[5]).toEqual({ acknowledgeInterrupted: false })
})

it('does not start a new task when there is no session to acknowledge', async () => {
  const run = runner()
  await expect(submit(run, '/acknowledge-interrupted')).rejects.toThrow('No session to recover')
  expect(run).not.toHaveBeenCalled()
})

it('shows pending call states and an actionable recovery command', () => {
  const event: SessionEvent = {
    version: 1,
    sessionId: 'saved-session',
    sequence: 1,
    timestamp: '2026-01-01T00:00:00.000Z',
    type: 'recovery.required',
    data: {
      calls: [
        { id: 'started', name: 'shell', input: {}, state: 'outcome_unknown' },
        { id: 'queued', name: 'create_file', input: {}, state: 'not_executed' },
      ],
    },
  }
  const text = eventText(event, 'interactive')
  expect(text).toContain('shell: outcome unknown')
  expect(text).toContain('create_file: not executed')
  expect(text).toContain('/acknowledge-interrupted')
  expect(text).toContain('Completed calls will not be replayed')
  expect(eventText(event)).toContain('weapp-agent resume saved-session --acknowledge-interrupted')
})
