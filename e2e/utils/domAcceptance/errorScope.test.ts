import type { DomAcceptance } from './types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { appendIdeReportEvent } from '../ideWarningReport'
import { flushRuntimeConsoleSessions } from '../runtimeConsoleSessions'
import { validateDomPlan } from './checkpoint'
import { runDomCheckpointAction } from './errorScope'

vi.mock('../ideWarningReport', () => ({ appendIdeReportEvent: vi.fn() }))
vi.mock('../runtimeConsoleSessions', () => ({ flushRuntimeConsoleSessions: vi.fn(async () => {}) }))

beforeEach(() => {
  vi.mocked(flushRuntimeConsoleSessions).mockReset().mockResolvedValue(undefined)
  vi.stubEnv('WEAPP_VITE_E2E_REPORT_EVENT_LOG_FILE', 'runtime.jsonl')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

function createPlan(): DomAcceptance {
  return {
    fixture: 'e2e-apps/base',
    provider: 'devtools',
    evidence: [],
    checkpoints: [{ id: 'reject', route: 'pages/index/index', action: 'reject request', nodes: [{ selector: '.result', text: 'rejected' }], expectedErrors: [{ source: 'runtime', level: 'error', channel: 'runtime', text: 'intentional failure', count: 1 }] }],
  }
}

describe('DOM checkpoint diagnostic scopes', () => {
  it('flushes previous errors before start and action errors before end', async () => {
    vi.mocked(flushRuntimeConsoleSessions)
      .mockImplementationOnce(async () => {
        appendIdeReportEvent({ source: 'runtime', kind: 'message', level: 'error', text: 'previous error' })
      })
      .mockImplementationOnce(async () => {
        await Promise.resolve()
        appendIdeReportEvent({ source: 'runtime', kind: 'message', level: 'error', text: 'action error' })
      })
    await runDomCheckpointAction(createPlan(), 'case-a', 'reject', async () => {})
    expect(vi.mocked(appendIdeReportEvent).mock.calls.map(([entry]) => entry.acceptanceScope?.boundary ?? entry.text)).toEqual([
      'previous error',
      'start',
      'action error',
      'end',
    ])
  })

  it('does not open a scope when the previous boundary cannot flush', async () => {
    const failure = new Error('previous flush failed')
    vi.mocked(flushRuntimeConsoleSessions).mockRejectedValueOnce(failure)
    const action = vi.fn(async () => {})
    await expect(runDomCheckpointAction(createPlan(), 'case-a', 'reject', action)).rejects.toBe(failure)
    expect(action).not.toHaveBeenCalled()
    expect(appendIdeReportEvent).not.toHaveBeenCalled()
  })

  it('retains action and flush failures and closes the failed scope', async () => {
    const actionFailure = new Error('action failed')
    const flushFailure = new Error('flush failed')
    vi.mocked(flushRuntimeConsoleSessions).mockResolvedValueOnce(undefined).mockRejectedValueOnce(flushFailure)
    await expect(runDomCheckpointAction(createPlan(), 'case-a', 'reject', async () => {
      throw actionFailure
    })).rejects.toMatchObject({
      errors: [actionFailure, flushFailure],
    })
    expect(vi.mocked(appendIdeReportEvent).mock.lastCall?.[0].acceptanceScope?.boundary).toBe('end')
  })

  it('brackets the operation with its case and checkpoint identity', async () => {
    const plan = createPlan()
    const operation = vi.fn(async () => {
      expect(appendIdeReportEvent).toHaveBeenCalledTimes(1)
      return 'done'
    })
    await expect(runDomCheckpointAction(plan, 'case-a', 'reject', operation)).resolves.toBe('done')
    const scopeId = plan.errorScopes?.[0]?.id
    expect(vi.mocked(appendIdeReportEvent).mock.calls.map(call => call[0].acceptanceScope)).toEqual([
      { id: scopeId, caseId: 'case-a', checkpointId: 'reject', boundary: 'start' },
      { id: scopeId, caseId: 'case-a', checkpointId: 'reject', boundary: 'end' },
    ])
  })

  it('closes the scope on a thrown operation and prevents replay', async () => {
    const plan = createPlan()
    const failure = new Error('operation failed')
    await expect(runDomCheckpointAction(plan, 'case-a', 'reject', async () => {
      throw failure
    })).rejects.toBe(failure)
    expect(vi.mocked(appendIdeReportEvent).mock.lastCall?.[0].acceptanceScope?.boundary).toBe('end')
    await expect(runDomCheckpointAction(plan, 'case-a', 'reject', async () => {})).rejects.toThrow('cannot be replayed')
  })

  it('rejects an unavailable journal or a checkpoint in the wrong order before the action', async () => {
    const operation = vi.fn()
    await expect(runDomCheckpointAction(createPlan(), 'case-a', 'other', operation)).rejects.toThrow('next unverified checkpoint')
    vi.stubEnv('WEAPP_VITE_E2E_REPORT_EVENT_LOG_FILE', '')
    await expect(runDomCheckpointAction(createPlan(), 'case-a', 'reject', operation)).rejects.toThrow('configured diagnostic')
    expect(operation).not.toHaveBeenCalled()
  })

  it('rejects broad, duplicate or nonpositive expected-error declarations', () => {
    for (const mutate of [
      (plan: DomAcceptance) => { plan.checkpoints[0]!.expectedErrors![0]!.text = '' },
      (plan: DomAcceptance) => { plan.checkpoints[0]!.expectedErrors![0]!.count = 0 },
      (plan: DomAcceptance) => { plan.checkpoints[0]!.expectedErrors!.push(plan.checkpoints[0]!.expectedErrors![0]!) },
    ]) {
      const plan = createPlan()
      mutate(plan)
      expect(() => validateDomPlan(plan)).toThrow('unique exact matches and positive counts')
    }
  })
})
