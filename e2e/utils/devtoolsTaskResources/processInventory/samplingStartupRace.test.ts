import type { ResolvedWechatDevtoolsTarget } from '../../../../packages/weapp-ide-cli/src/devtoolsTarget'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleInstallationProcesses } from '../processes'
import { createInspectorFixture } from './inspectorFixture'

const mocks = vi.hoisted(() => ({ execute: vi.fn(), root: '' }))
vi.mock('execa', () => ({ execa: mocks.execute }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsTarget/host', () => ({ resolveWechatDevtoolsInstallationRoot: () => mocks.root }))

const target = { installationId: 'selected' } as ResolvedWechatDevtoolsTarget
const row = (pid: number, rss = 10) => `${pid} 1 ${rss} S Mon Oct 19 10:00:00 2026`
let directory: string

beforeEach(async () => {
  vi.resetAllMocks()
  directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'sampling-startup-contract-')))
  mocks.root = directory
})
afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(directory, { recursive: true, force: true })
})

function scheduler(exit: 'bootstrap' | 'after-anchor') {
  const events: string[] = []
  let ready = false
  let transientAlive = true
  let frames = 0
  const frame = () => {
    events.push('anchor')
    return [row(11, frames++ ? 100 : 10), row(22), ...(transientAlive ? [row(33)] : [])].join('\n')
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
    if (exit === 'after-anchor') {
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
  it('takes the initial RSS anchor after inspector bootstrap instead of spending its identity window on startup', async () => {
    const events = scheduler('bootstrap')
    const sample = await sampleInstallationProcesses(target, 'darwin')
    expect(sample).toMatchObject({ status: 'observed', value: {
      installationRssBytes: { status: 'observed', value: 10 * 1024 },
      unclassifiedProcessCount: 0,
      rssAnchor: 'initial-ps-inventory-only; later-rows-never-replace-or-add-rss',
    } })
    expect(events.indexOf('bootstrap')).toBeLessThan(events.indexOf('anchor'))
  })

  it('retains an exit after the initial anchor as an unknown identity without filling later RSS', async () => {
    scheduler('after-anchor')
    expect(await sampleInstallationProcesses(target, 'darwin')).toMatchObject({ status: 'observed', value: {
      verifiedMemberRssBytes: 10 * 1024,
      installationRssBytes: { status: 'unavailable' },
      unclassifiedProcessCount: 1,
      unclassifiedProcesses: [{ pid: 33, final: null, causes: [{ reason: 'process-absent', firstObserved: { round: 1, phase: 'after-kernel' } }] }],
    } })
  })
})
