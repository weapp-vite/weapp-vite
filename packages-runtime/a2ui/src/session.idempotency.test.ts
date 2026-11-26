import type { SessionSetupResult } from './sessionTestUtils'
import { describe, expect, it, vi } from 'vitest'
import {
  createSurfaceMessage,
  findNode,
  rootOf,
  setupSession,
} from './sessionTestUtils'

function actionSurface(result: SessionSetupResult, surfaceId = 's1') {
  result.session.receive(createSurfaceMessage(surfaceId, [
    { id: 'root', component: 'Column', children: ['submit'] },
    {
      id: 'submit',
      component: 'Button',
      child: 'submitLabel',
      action: { event: { name: 'submit' } },
    },
    { id: 'submitLabel', component: 'Text', text: '提交' },
  ]))
  return findNode(rootOf(result, surfaceId), 'submit')!
}

describe('createA2uiSession action idempotency', () => {
  it('shares a pending action and emits it once for the same eventId', async () => {
    let calls = 0
    let release!: () => void
    let started!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const actionStarted = new Promise<void>((resolve) => {
      started = resolve
    })
    const result = setupSession({
      resolveValue: async (args) => {
        calls++
        started()
        await gate
        return args.value
      },
    })
    result.session.receive(createSurfaceMessage('s1', [
      { id: 'root', component: 'Column', children: ['submit'] },
      {
        id: 'submit',
        component: 'Button',
        child: 'submitLabel',
        action: {
          event: {
            name: 'submit',
            context: { result: { '@call': 'resolveValue', 'args': { value: 'done' } } },
          },
        },
      },
      { id: 'submitLabel', component: 'Text', text: '提交' },
    ]))
    const button = findNode(rootOf(result), 'submit')!

    const first = result.session.interact('s1', { type: 'action', nodeId: button.id, eventId: 'event-1' })
    const duplicate = result.session.interact('s1', { type: 'action', nodeId: button.id, eventId: 'event-1' })
    await actionStarted
    expect(calls).toBe(1)

    release()
    await Promise.all([first, duplicate])
    expect(calls).toBe(1)
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0]!.action.context.result).toBe('done')
    result.session.dispose()
  })

  it('deduplicates successful actions until the idempotency window expires', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    try {
      const result = setupSession()
      const button = actionSurface(result)

      await result.session.interact('s1', { type: 'action', nodeId: button.id, eventId: 'event-1' })
      await result.session.interact('s1', { type: 'action', nodeId: button.id, eventId: 'event-1' })
      expect(result.actions).toHaveLength(1)

      vi.setSystemTime(new Date('2026-01-01T00:00:30Z'))
      await result.session.interact('s1', { type: 'action', nodeId: button.id, eventId: 'event-1' })
      expect(result.actions).toHaveLength(2)
      result.session.dispose()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('allows retry with the same eventId after action delivery fails', async () => {
    let deliveries = 0
    const result = setupSession(undefined, undefined, {
      onAction: () => {
        deliveries++
        if (deliveries === 1) {
          throw new Error('offline')
        }
      },
    })
    const button = actionSurface(result)

    await expect(result.session.interact('s1', {
      type: 'action',
      nodeId: button.id,
      eventId: 'event-1',
    })).rejects.toThrow('offline')
    await result.session.interact('s1', { type: 'action', nodeId: button.id, eventId: 'event-1' })

    expect(deliveries).toBe(2)
    expect(result.actions).toHaveLength(2)
    result.session.dispose()
  })

  it('scopes eventId deduplication to each surface', async () => {
    const result = setupSession()
    const first = actionSurface(result, 's1')
    const second = actionSurface(result, 's2')

    await result.session.interact('s1', { type: 'action', nodeId: first.id, eventId: 'event-1' })
    await result.session.interact('s2', { type: 'action', nodeId: second.id, eventId: 'event-1' })

    expect(result.actions.map(message => message.action.surfaceId)).toEqual(['s1', 's2'])
    result.session.dispose()
  })

  it('rejects an empty eventId without executing the action', async () => {
    const result = setupSession()
    const button = actionSurface(result)

    await expect(result.session.interact('s1', {
      type: 'action',
      nodeId: button.id,
      eventId: ' ',
    })).rejects.toThrow(/eventId/)
    expect(result.actions).toHaveLength(0)
    result.session.dispose()
  })
})
