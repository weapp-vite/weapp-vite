import type { ResolvedWechatDevtoolsTarget } from '../../../../packages/weapp-ide-cli/src/devtoolsTarget'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleInstallationProcesses } from '../processes'
import { createInspectorFixture } from './inspectorFixture'

const mocks = vi.hoisted(() => ({ execute: vi.fn(), images: vi.fn(), root: '' }))
vi.mock('execa', () => ({ execa: mocks.execute }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/darwin', () => ({ readDarwinTextImages: mocks.images }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsTarget/host', () => ({ resolveWechatDevtoolsInstallationRoot: () => mocks.root }))

const target = { installationId: 'selected' } as ResolvedWechatDevtoolsTarget
const row = (pid: number, rss = 10) => `${pid} 1 ${rss} S Mon Oct 19 10:00:00 2026`
let directory: string

beforeEach(async () => {
  vi.resetAllMocks()
  directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'sampling-startup-contract-')))
  mocks.root = directory
  mocks.images.mockRejectedValue(new Error('Fixture text image unavailable'))
})
afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(directory, { recursive: true, force: true })
})

function scheduler(exit: 'bootstrap' | 'preparation' | 'after-anchor') {
  const events: string[] = []
  let ready = false
  let transientAlive = true
  let frames = 0
  const frame = () => {
    frames++
    events.push(frames === 4 ? 'rss-anchor' : 'identity-frame')
    if (exit === 'after-anchor' && frames === 5) {
      transientAlive = false
    }
    return [row(11, frames === 4 ? 40 : frames * 100), row(22), ...(transientAlive ? [row(33)] : [])].join('\n')
  }
  const bootstrap = () => {
    if (!ready) {
      ready = true
      events.push('bootstrap')
      if (exit === 'bootstrap') {
        transientAlive = false
      }
    }
  }
  const paths = (pids: number[]) => {
    if (exit === 'preparation') {
      transientAlive = false
    }
    return pids.map(pid => ({ pid, executable: pid === 33 ? null : path.join(directory, pid === 11 ? 'selected' : '../foreign') }))
  }
  mocks.execute.mockImplementation((command: string, args: string[]) => {
    if (command === '/bin/ps') {
      return Object.assign(Promise.resolve({ stdout: frame(), stderr: '', exitCode: 0 }), { pid: 99 })
    }
    else if (command === '/usr/bin/osascript') {
      const request: unknown = args.at(-1)?.startsWith('[') ? JSON.parse(args.at(-1)!) : undefined
      if (Array.isArray(request)) {
        bootstrap()
        return Object.assign(Promise.resolve({ stdout: JSON.stringify(paths(request as number[])), stderr: '', exitCode: 0 }), { pid: 99 })
      }
      return createInspectorFixture({ onReady: bootstrap, response: pids => JSON.stringify({ phase: 'paths', paths: paths(pids) }) }).child
    }
    else {
      throw new Error(`Unexpected inspection command: ${command}`)
    }
  })
  return events
}

describe('resource sampling bootstrap race', () => {
  it('prepares identities after bootstrap and then takes exactly one independent RSS anchor', async () => {
    const events = scheduler('bootstrap')
    const sample = await sampleInstallationProcesses(target, 'darwin')
    expect(sample).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'observed', value: 40 * 1024 },
      unclassifiedProcessCount: 0,
      rssAnchor: 'single-post-preparation-ps-inventory; preparation-and-later-rows-never-contribute-rss',
    } })
    expect(events).toEqual(['bootstrap', 'identity-frame', 'identity-frame', 'identity-frame', 'rss-anchor', 'identity-frame'])
  })

  it('records an unknown preparation exit without inventing foreign ownership or using preparation RSS', async () => {
    const events = scheduler('preparation')
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      verifiedMemberRssBytes: 40 * 1024,
      installationRssBytes: { status: 'observed', value: 40 * 1024 },
      unclassifiedProcessCount: 0,
      verifiedNewForeignProcessCount: 0,
      preAnchorExitedProcesses: [{ pid: 33, final: null, causes: [
        { reason: 'process-absent', firstObserved: { round: 1, phase: 'after-kernel' } },
        { reason: 'pre-anchor-exited', firstObserved: { round: 1, phase: 'rss-anchor' } },
      ] }],
    } })
    expect(events.filter(event => event === 'rss-anchor')).toHaveLength(1)
    expect(mocks.images).not.toHaveBeenCalled()
  })

  it('retains an unknown exit after the fixed anchor without filling later RSS', async () => {
    scheduler('after-anchor')
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      verifiedMemberRssBytes: 40 * 1024,
      installationRssBytes: { status: 'unavailable' },
      unclassifiedProcessCount: 1,
      unclassifiedProcesses: [{ pid: 33, final: null, causes: [{ reason: 'text-images-query-failed', firstObserved: { round: 1, phase: 'fallback' } }, { reason: 'process-absent', firstObserved: { round: 1, phase: 'after-anchor' } }] }],
    } })
  })

  it.each([false, true])('reuses the warmed helper for a newly appeared PID without hiding its actual exit (%s)', async (exitBeforePostcondition) => {
    let inspector: ReturnType<typeof createInspectorFixture> | undefined
    let frames = 0
    let transientAlive = true
    const requests: number[][] = []
    mocks.execute.mockImplementation((command: string) => {
      if (command === '/usr/bin/osascript') {
        if (inspector) {
          transientAlive = false
          throw new Error('A second cold helper lost the new identity window.')
        }
        inspector = createInspectorFixture({ response(pids) {
          requests.push(pids)
          if (exitBeforePostcondition && pids.includes(44)) {
            transientAlive = false
          }
          return JSON.stringify({ phase: 'paths', paths: pids.map(pid => ({ pid, executable: path.join(directory, pid === 11 ? 'selected' : '../foreign') })) })
        } })
        return inspector.child
      }
      if (command === '/bin/ps') {
        frames++
        if (inspector?.owner.exitCode !== null) {
          transientAlive = false
        }
        const stdout = [row(11, frames === 4 ? 40 : frames * 100), row(22), ...(frames > 4 && transientAlive ? [row(44)] : [])].join('\n')
        return Object.assign(Promise.resolve({ stdout, stderr: '', exitCode: 0 }), { pid: 98 })
      }
      throw new Error(`Unexpected inspection command: ${command}`)
    })
    const sample = await sampleInstallationProcesses(target, 'darwin')
    expect(sample).toMatchObject({ status: 'observed', value: {
      verifiedMemberRssBytes: 40 * 1024,
      installationRssBytes: exitBeforePostcondition ? { status: 'unavailable' } : { status: 'observed', value: 40 * 1024 },
      unclassifiedProcessCount: 0,
      inventoryRoundCount: 2,
      verifiedNewForeignProcessCount: exitBeforePostcondition ? 0 : 1,
      uninspectedNewProcessCount: exitBeforePostcondition ? 1 : 0,
      newProcesses: [{ pid: 44, classification: exitBeforePostcondition ? 'unclassified' : 'verified-foreign', ...(exitBeforePostcondition ? { final: null, causes: [{ reason: 'process-absent', firstObserved: { round: 2, phase: 'after-kernel' } }] } : { causes: [] }) }],
      rssAnchor: 'single-post-preparation-ps-inventory; preparation-and-later-rows-never-contribute-rss',
    } })
    expect(requests).toEqual([[11, 22], [44]])
    expect(mocks.execute.mock.calls.filter(call => call[0] === '/usr/bin/osascript')).toHaveLength(1)
    expect(frames).toBe(7)
    expect(inspector?.events).toEqual(['ready', 'request', 'request', 'eof', 'exit'])
  })
})
