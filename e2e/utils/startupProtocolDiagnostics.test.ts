import { afterEach, describe, expect, it, vi } from 'vitest'
import { evaluateExpectedErrors } from '../scripts/domAcceptanceReport/expectedErrors'
import { appendIdeReportEvent } from './ideWarningReport'
import { createStartupProtocolDiagnostics, isStartupCurrentPageProtocolError } from './startupProtocolDiagnostics'

vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn() }))
const metadataFailure = new Error('Cannot destructure property \'rawPath\' of \'t.getPageMetaByWebviewId(...)\' as it is null.')

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('startup protocol evidence', () => {
  it('keeps every failed attempt and records recovery only after page readiness', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z'))
    const diagnostics = createStartupProtocolDiagnostics('fixture', '/pages/index/index')
    diagnostics.record(metadataFailure)
    vi.setSystemTime(new Date('2026-09-01T00:00:01Z'))
    diagnostics.record(metadataFailure)
    diagnostics.finish(true)
    diagnostics.finish(true)
    const events = vi.mocked(appendIdeReportEvent).mock.calls.map(([event]) => event)
    expect(events.map(event => [event.level, event.startupProtocol?.state, event.startupProtocol?.attempts])).toEqual([
      ['warn', 'retrying', 1],
      ['warn', 'retrying', 2],
      ['info', 'recovered', 2],
    ])
    expect(events[0]?.text).toBe(metadataFailure.message)
    expect(events[2]?.startupProtocol).toMatchObject({ firstFailureAt: '2026-09-01T00:00:00.000Z', lastFailureAt: '2026-09-01T00:00:01.000Z' })
  })
  it('records unresolved protocol failures as errors without clearing earlier attempts', () => {
    const diagnostics = createStartupProtocolDiagnostics('fixture', '/pages/index/index')
    diagnostics.record(metadataFailure)
    diagnostics.finish(false)
    expect(appendIdeReportEvent).toHaveBeenLastCalledWith(expect.objectContaining({ level: 'error', startupProtocol: expect.objectContaining({ state: 'unresolved' }) }))
    expect(appendIdeReportEvent).toHaveBeenCalledTimes(2)
  })
  it('does not consume a business exception when startup protocol recovery succeeds', () => {
    const diagnostics = createStartupProtocolDiagnostics('fixture', '/pages/index/index')
    diagnostics.record(metadataFailure)
    appendIdeReportEvent({ source: 'runtime', kind: 'message', project: 'fixture', channel: 'exception', level: 'exception', text: 'business startup failure' })
    diagnostics.finish(true)
    const entries = vi.mocked(appendIdeReportEvent).mock.calls.map(([event]) => ({
      observedAt: '2026-09-01T00:00:00.000Z',
      caseId: null,
      phase: 'outside-case' as const,
      event: { ...event },
    }))
    expect(evaluateExpectedErrors([], entries)).toEqual(['Unclassified IDE runtime exception outside a case: business startup failure'])
  })

  it('does not classify business exceptions or other protocol methods as recoverable startup errors', () => {
    for (const error of [new Error('business failed'), new Error('rawPath is null'), Object.assign(new Error('timeout'), { code: 'DEVTOOLS_PROTOCOL_TIMEOUT', method: 'Page.getElement' })]) {
      expect(isStartupCurrentPageProtocolError(error)).toBe(false)
    }
    expect(isStartupCurrentPageProtocolError(Object.assign(new Error('timeout'), { code: 'DEVTOOLS_PROTOCOL_TIMEOUT', method: 'App.getCurrentPage' }))).toBe(true)
  })
})
