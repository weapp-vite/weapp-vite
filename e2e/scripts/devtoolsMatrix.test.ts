import type { ResolvedWechatDevtoolsTarget } from 'weapp-ide-cli'
import { describe, expect, it, vi } from 'vitest'
import { parseDevtoolsMatrixTargets, runDevtoolsMatrix } from './devtoolsMatrix'

const requests = parseDevtoolsMatrixTargets('stable,rc,nightly')
const resolve = async (request: typeof requests[number]) => ({ cliPath: request.devtoolsChannel, installationId: request.devtoolsChannel, appPath: 'fixture', profileDir: 'fixture', channel: request.devtoolsChannel, version: '2.02.2608080' })
function observed(installationId: string, exitCode = 0) {
  return { exitCode, runtimeVersions: [{ installationId, version: '2.02.2608080', baseLibraryVersion: '3.17.3' }] }
}
describe('DevTools version matrix', () => {
  it('continues after assertions fail and preserves all version outcomes in order', async () => {
    const order: string[] = []
    const result = await runDevtoolsMatrix(requests, { resolve, run: async (target) => {
      order.push(target.installationId)
      return observed(target.installationId, target.channel === 'rc' ? 1 : 0)
    } })
    expect(order).toEqual(['stable', 'rc', 'nightly'])
    expect(result.entries.map(entry => entry.status)).toEqual(['passed', 'failed', 'passed'])
    expect(result.exitCode).toBe(1)
  })
  it('records a missing installation and continues other installed targets', async () => {
    const result = await runDevtoolsMatrix(requests, { resolve: async (request) => {
      if (request.devtoolsChannel === 'rc') {
        throw Object.assign(new Error('not installed'), { code: 'WECHAT_DEVTOOLS_INSTALLATION_NOT_FOUND' })
      }
      return await resolve(request)
    }, run: async target => observed(target.installationId) })
    expect(result.entries.map(entry => entry.status)).toEqual(['passed', 'blocked', 'passed'])
  })
  it('halts after unsafe cleanup and lists remaining targets as not executed', async () => {
    const run = vi.fn(async () => ({ exitCode: 1, unsafeReason: 'host still alive' }))
    const result = await runDevtoolsMatrix(requests, { resolve, run })
    expect(run).toHaveBeenCalledTimes(1)
    expect(result.entries.map(entry => entry.status)).toEqual(['blocked', 'not-executed', 'not-executed'])
  })
  it('records login expiry as blocked and continues the next installed version without retrying', async () => {
    const run = vi.fn(async (target: ResolvedWechatDevtoolsTarget) => target.channel === 'stable'
      ? { exitCode: 10, runtimeBlocker: { code: 'needs-login' as const, reason: '需要重新登录' } }
      : observed(target.installationId))
    const result = await runDevtoolsMatrix(requests, { resolve, run })
    expect(run).toHaveBeenCalledTimes(3)
    expect(result.entries.map(entry => entry.status)).toEqual(['blocked', 'passed', 'passed'])
    expect(result.entries[0]).toMatchObject({ reason: '需要重新登录', runtimeBlocker: { code: 'needs-login' } })
    expect(result.exitCode).toBe(1)
  })
  it('records each requested channel query and permits offline local selection', async () => {
    const queryOfficial = vi.fn(async (request: typeof requests[number]) => {
      if (request.devtoolsChannel === 'rc') {
        throw new Error('offline')
      }
      return { channel: request.devtoolsChannel, version: '2.02.2608080', source: 'fixture', queriedAt: new Date().toISOString() }
    })
    const result = await runDevtoolsMatrix(requests, { resolve, queryOfficial, run: async target => observed(target.installationId) })
    expect(queryOfficial.mock.calls.map(([request]) => request.devtoolsChannel)).toEqual(['stable', 'rc', 'nightly'])
    expect(result.entries.map(entry => entry.official?.channel)).toEqual(['stable', 'rc', 'nightly'])
    expect(result.entries[1]!.official).toMatchObject({ version: null, error: 'offline' })
    expect(result.exitCode).toBe(0)
  })
  it('keeps a successful filtered suite incomplete without halting the next version', async () => {
    const result = await runDevtoolsMatrix(requests, { resolve, run: async target => ({ ...observed(target.installationId), incompleteReason: 'partial coverage' }) })
    expect(result.entries.map(entry => entry.status)).toEqual(['blocked', 'blocked', 'blocked'])
    expect(result.entries[0]!.reason).toBe('partial coverage')
    expect(result.exitCode).toBe(1)
  })
  it('does not count selected metadata as observed runtime evidence', async () => {
    const result = await runDevtoolsMatrix(requests, { resolve, run: async () => ({ exitCode: 0 }) })
    expect(result.entries.every(entry => entry.status === 'blocked')).toBe(true)
    expect(result.exitCode).toBe(1)
  })
  it('halts on runtime installation mismatch even when a child exits successfully', async () => {
    const run = vi.fn(async () => observed('other-installation'))
    const result = await runDevtoolsMatrix(requests, { resolve, run })
    expect(run).toHaveBeenCalledTimes(1)
    expect(result.entries.map(entry => entry.status)).toEqual(['blocked', 'not-executed', 'not-executed'])
    expect(result.entries[0]!.reason).toContain('Observed runtime')
  })
  it('does not launch another target after cancellation', async () => {
    const controller = new AbortController()
    const run = vi.fn(async (target) => {
      controller.abort()
      return observed(target.installationId)
    })
    const result = await runDevtoolsMatrix(requests, { resolve, run }, controller.signal)
    expect(run).toHaveBeenCalledTimes(1)
    expect(result.entries[0]!.status).toBe('blocked')
    expect(result.entries.slice(1).map(entry => entry.status)).toEqual(['not-executed', 'not-executed'])
  })
  it('continues after a strict official selection check blocks a target', async () => {
    const result = await runDevtoolsMatrix(requests, { resolve: async (request) => {
      if (request.devtoolsChannel === 'stable') {
        throw new Error('DEVTOOLS_OFFICIAL_LATEST_REQUIRED')
      }
      return resolve(request)
    }, run: async target => observed(target.installationId) })
    expect(result.entries.map(entry => entry.status)).toEqual(['blocked', 'passed', 'passed'])
  })
  it.each(['', 'stable,stable', 'beta', 'nightly@latest'])('rejects malformed target lists %s', (value) => {
    expect(() => parseDevtoolsMatrixTargets(value)).toThrow()
  })
})
