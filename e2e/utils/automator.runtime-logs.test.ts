import { EventEmitter } from 'node:events'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enhanceMiniProgramWithRuntimeLogs, launchAutomator, resetAutomatorRuntimeLogs } from './automator'
import { launchHeadlessAutomator } from './automator.headless'
import { appendIdeReportEvent } from './ideWarningReport'

vi.mock('./automator.headless', () => ({ launchHeadlessAutomator: vi.fn() }))
vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn(), resolveReportProjectPath: () => 'e2e-apps/base' }))

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

function createSession() {
  return Object.assign(new EventEmitter(), { close: vi.fn(async () => {}) })
}

describe('automator runtime diagnostic lifecycle', () => {
  it('attaches headless console collection and preserves exceptions until close', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'headless')
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const session = createSession()
    vi.mocked(launchHeadlessAutomator).mockImplementation(async (options) => {
      await options.onSessionCreated?.(session as any)
      session.emit('console', { level: 'error', args: ['startup failure'] })
      return session as any
    })
    const launched = await launchAutomator({ projectPath: 'e2e-apps/base' })
    session.emit('console', { type: 'error', args: ['headless failure'] })
    session.emit('exception', { exceptionDetails: { text: 'headless exception' } })
    await launched.close()
    expect(appendIdeReportEvent).toHaveBeenCalledWith(expect.objectContaining({ level: 'error', text: 'startup failure' }))
    expect(appendIdeReportEvent).toHaveBeenCalledWith(expect.objectContaining({ level: 'error', text: 'headless failure' }))
    expect(appendIdeReportEvent).toHaveBeenCalledWith(expect.objectContaining({ level: 'exception', text: 'headless exception' }))
    expect(session.listenerCount('console')).toBe(0)
    expect(session.listenerCount('exception')).toBe(0)
  })

  it('records a thrown headless bootstrap failure without changing the rejection', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'headless')
    const failure = new Error('bootstrap failed')
    vi.mocked(launchHeadlessAutomator).mockRejectedValue(failure)
    await expect(launchAutomator({ projectPath: 'e2e-apps/base' })).rejects.toBe(failure)
    expect(appendIdeReportEvent).toHaveBeenCalledWith(expect.objectContaining({ source: 'runtime', channel: 'launch', level: 'error', text: expect.stringContaining('bootstrap failed') }))
  })

  it('retains startup journal entries after in-memory reset and does not duplicate listeners', async () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const session = createSession()
    enhanceMiniProgramWithRuntimeLogs(session, 'e2e-apps/base')
    enhanceMiniProgramWithRuntimeLogs(session, 'e2e-apps/base')
    session.emit('console', { type: 'error', args: ['startup failure'] })
    resetAutomatorRuntimeLogs(session)
    expect(session.listenerCount('console')).toBe(1)
    expect(vi.mocked(appendIdeReportEvent).mock.calls.filter(call => call[0].text === 'startup failure')).toHaveLength(1)
    await session.close()
    expect(vi.mocked(appendIdeReportEvent).mock.calls.filter(call => call[0].text === 'startup failure')).toHaveLength(1)
  })
})
