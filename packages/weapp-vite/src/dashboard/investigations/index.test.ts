import type { DevframeInstance } from 'devframe/initiate'
import type { AnalyzeDashboardDevframeController, AnalyzeSubpackagesResult, DashboardDevframeState, DashboardInvestigation } from '../index'
import { randomUUID } from 'node:crypto'
import { initDevframe } from 'devframe/initiate'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAnalyzeDashboardDevframe } from '../index'

const hosts: Array<{ controller: AnalyzeDashboardDevframeController, instance: DevframeInstance }> = []
const proposal = {
  summary: 'Reduce the selected module contribution',
  changes: [{ path: 'src/app.ts', description: 'Remove unused code' }],
  checks: ['pnpm test'],
  risks: ['Public behavior must remain unchanged'],
}
const receipt = {
  outcome: 'completed' as const,
  summary: 'External work finished; awaiting human verification',
  changedFiles: ['src/app.ts'],
  checks: [{ command: 'pnpm test', outcome: 'passed' as const, summary: 'External Agent reports a pass' }],
}

function report(): AnalyzeSubpackagesResult {
  return {
    packages: [{
      id: 'main',
      type: 'main',
      label: 'Main package',
      files: [{
        file: 'app.js',
        type: 'chunk',
        from: 'main',
        size: 100,
        gzipSize: 50,
        modules: [{ id: 'app', source: 'app.ts', sourceType: 'src', bytes: 60, originalBytes: 90 }],
      }, { file: 'unknown.js', type: 'chunk', from: 'main' }],
    }],
    modules: [{ id: 'source-only', source: 'source-only.ts', sourceType: 'src', packages: [{ packageId: 'main', files: ['app.js'] }] }],
    subPackages: [],
    glassEasel: { detected: false, minimumBaseLibrary: '3.8.12', migrationGuide: '', diagnostics: [], summary: { errors: 0, warnings: 0 } },
  }
}

function identity(state: DashboardDevframeState) {
  return { sessionId: state.sessionId, revision: state.revision, reportHash: state.analyze.current.hash }
}

async function host() {
  const controller = createAnalyzeDashboardDevframe({ roots: {}, snapshot: { current: report(), previous: null, artifacts: new Map() } })
  const instance = initDevframe(controller.definition, { auth: false, base: '/', sse: false, ws: false, mcp: false })
  hosts.push({ controller, instance })
  await instance.ready
  const context = await instance.context
  const dashboard = context.scope('weapp-vite')
  const state = await dashboard.rpc.call('get-dashboard-state')
  const request = { report: identity(state), target: { kind: 'artifact' as const, packageId: 'main', file: 'app.js' }, question: 'Why is this artifact large?' }
  return { controller, instance, context, dashboard, state, request }
}

/** 通过真实 RPC 进入给定阶段，供互斥状态反例复用。 */
async function atStatus(status: 'submitted' | 'claimed' | 'proposed' | 'authorized' | 'executing') {
  const current = await host()
  const { dashboard } = current
  let task = await dashboard.rpc.call('create-investigation', current.request)
  let claimToken = ''
  if (status !== 'submitted') {
    const claim = await dashboard.rpc.call('claim-investigation', { id: task.id, version: task.version, agentName: 'External Agent' })
    task = claim.investigation
    claimToken = claim.claimToken
    if (status !== 'claimed') {
      task = await dashboard.rpc.call('propose-investigation', { id: task.id, version: task.version, claimToken, proposal })
      if (status !== 'proposed') {
        task = await dashboard.rpc.call('authorize-investigation', { id: task.id, version: task.version, proposalId: task.proposal!.id })
        if (status !== 'authorized') {
          task = await dashboard.rpc.call('start-investigation', { id: task.id, version: task.version, claimToken })
        }
      }
    }
  }
  return { ...current, task, claimToken }
}

afterEach(async () => {
  for (const { controller, instance } of hosts.splice(0)) {
    controller.dispose()
    await instance.close()
  }
})

describe('investigation protocol authority', () => {
  it('arbitrates claim races and keeps private tokens out of all published snapshots', async () => {
    const { context, dashboard, request, state } = await host()
    const broadcast = vi.spyOn(context.rpc, 'broadcast')
    const created = await dashboard.rpc.call('create-investigation', request)
    const claims = await Promise.allSettled(['one', 'two'].map(agentName => dashboard.rpc.call('claim-investigation', {
      id: created.id,
      version: created.version,
      agentName,
    })))
    expect(claims.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(claims.filter(result => result.status === 'rejected')).toHaveLength(1)
    const winner = claims.find(result => result.status === 'fulfilled')!
    if (winner.status !== 'fulfilled') {
      throw new Error('Expected one successful claim')
    }
    const { investigation, claimToken } = winner.value
    expect(claimToken).toMatch(/^[a-f0-9]{64}$/)
    await expect(dashboard.rpc.call('claim-investigation', { id: created.id, version: investigation.version, agentName: 'again' })).rejects.toThrow()
    await expect(dashboard.rpc.call('propose-investigation', { id: created.id, version: investigation.version, claimToken: '0'.repeat(64), proposal })).rejects.toThrow('claim token')
    const current = await dashboard.rpc.call('get-dashboard-state')
    expect(current.revision).toBe(state.revision)
    expect(current.investigations.version).toBe(2)
    expect(JSON.stringify(current)).not.toContain(claimToken)
    expect(JSON.stringify(await dashboard.rpc.call('list-investigations'))).not.toContain(claimToken)
    expect(JSON.stringify(await dashboard.rpc.call('get-investigation', { id: created.id }))).not.toContain(claimToken)
    expect(broadcast.mock.calls).toHaveLength(2)
    expect(JSON.stringify(broadcast.mock.calls)).not.toContain(claimToken)
    request.question = 'mutated caller input'
    created.evidence.rawBytes = 999
    current.investigations.items[0]!.agent!.name = 'forged'
    const fresh = await dashboard.rpc.call('get-investigation', { id: created.id })
    expect(fresh.question).toBe('Why is this artifact large?')
    expect(fresh.evidence.rawBytes).toBe(100)
    expect(fresh.agent?.name).toBe(investigation.agent?.name)
  })

  it('binds authorization to the exact proposal and consumes execution only once', async () => {
    const { dashboard, task: claimed, claimToken, controller, request } = await atStatus('claimed')
    const agent = { id: claimed.id, version: claimed.version, claimToken }
    await expect(dashboard.rpc.call('start-investigation', agent)).rejects.toThrow()
    await expect(dashboard.rpc.call('complete-investigation', { ...agent, receipt })).rejects.toThrow()
    const first = await dashboard.rpc.call('propose-investigation', { ...agent, proposal })
    const second = await dashboard.rpc.call('propose-investigation', { ...agent, version: first.version, proposal: { ...proposal, summary: 'Updated plan' } })
    expect(second.proposal!.id).not.toBe(first.proposal!.id)
    await expect(dashboard.rpc.call('authorize-investigation', { id: second.id, version: first.version, proposalId: first.proposal!.id })).rejects.toThrow('version conflict')
    await expect(dashboard.rpc.call('authorize-investigation', { id: second.id, version: second.version, proposalId: first.proposal!.id })).rejects.toThrow('proposal changed')
    const authorized = await dashboard.rpc.call('authorize-investigation', { id: second.id, version: second.version, proposalId: second.proposal!.id })
    await expect(dashboard.rpc.call('propose-investigation', { ...agent, version: authorized.version, proposal })).rejects.toThrow()
    second.proposal!.changes[0]!.path = 'forged.ts'
    const executing = await dashboard.rpc.call('start-investigation', { ...agent, version: authorized.version })
    expect(executing.proposal?.changes[0]?.path).toBe('src/app.ts')
    await expect(dashboard.rpc.call('start-investigation', { ...agent, version: authorized.version })).rejects.toThrow('version conflict')
    await expect(dashboard.rpc.call('start-investigation', { ...agent, version: executing.version })).rejects.toThrow()
    await expect(dashboard.rpc.call('authorize-investigation', { id: executing.id, version: executing.version, proposalId: second.proposal!.id })).rejects.toThrow()
    const next = report()
    next.packages[0]!.files[0]!.size = 70
    await controller.update(next, new Map())
    expect(await dashboard.rpc.call('get-investigation', { id: executing.id })).toMatchObject({ version: executing.version, status: 'executing', report: request.report })
    const completed = await dashboard.rpc.call('complete-investigation', { ...agent, version: executing.version, receipt })
    expect(completed.status).toBe('completed')
    expect(completed.verification).toBeNull()
    await expect(dashboard.rpc.call('complete-investigation', { ...agent, version: completed.version, receipt })).rejects.toThrow()
    const currentReport = identity(await dashboard.rpc.call('get-dashboard-state'))
    for (const invalid of [request.report, { ...currentReport, sessionId: randomUUID() }, { ...currentReport, reportHash: '0'.repeat(64) }]) {
      await expect(dashboard.rpc.call('verify-investigation', { id: completed.id, version: completed.version, report: invalid, summary: 'Reviewed' })).rejects.toThrow()
    }
    const verified = await dashboard.rpc.call('verify-investigation', { id: completed.id, version: completed.version, report: currentReport, summary: 'Human reviewed the new build and behavior' })
    expect(verified).toMatchObject({ status: 'verified', verification: { report: currentReport, after: { rawBytes: 70 }, summary: 'Human reviewed the new build and behavior' } })
    await expect(dashboard.rpc.call('verify-investigation', { id: verified.id, version: verified.version, report: currentReport, summary: 'Replay' })).rejects.toThrow()
  })

  it.each(['submitted', 'claimed', 'proposed', 'authorized'] as const)('invalidates %s and its grant on every report publication', async (status) => {
    const { dashboard, controller, task, claimToken } = await atStatus(status)
    await controller.update(report(), new Map())
    const stale = await dashboard.rpc.call('get-investigation', { id: task.id })
    expect(stale).toMatchObject({ status: 'stale', version: task.version + 1, authorization: null })
    const request = { id: stale.id, version: stale.version, claimToken }
    await expect(dashboard.rpc.call('claim-investigation', { id: stale.id, version: stale.version, agentName: 'late' })).rejects.toThrow()
    await expect(dashboard.rpc.call('propose-investigation', { ...request, proposal })).rejects.toThrow()
    await expect(dashboard.rpc.call('authorize-investigation', { id: stale.id, version: stale.version, proposalId: task.proposal?.id ?? randomUUID() })).rejects.toThrow()
    await expect(dashboard.rpc.call('start-investigation', request)).rejects.toThrow()
  })

  it.each(['submitted', 'claimed', 'proposed', 'authorized', 'executing'] as const)('cancels %s without accepting late external receipts', async (status) => {
    const { dashboard, task, claimToken } = await atStatus(status)
    const cancelled = await dashboard.rpc.call('cancel-investigation', { id: task.id, version: task.version })
    expect(cancelled.status).toBe('cancelled')
    await expect(dashboard.rpc.call('complete-investigation', { id: task.id, version: cancelled.version, claimToken, receipt })).rejects.toThrow()
    await expect(dashboard.rpc.call('cancel-investigation', { id: task.id, version: cancelled.version })).rejects.toThrow()
  })

  it.each(['completed', 'failed'] as const)('retains %s receipts over rebuilds and only verifies completed against a newer current report', async (outcome) => {
    const { dashboard, task, claimToken, controller, request } = await atStatus('executing')
    const completed = await dashboard.rpc.call('complete-investigation', { id: task.id, version: task.version, claimToken, receipt: { ...receipt, outcome } })
    await expect(dashboard.rpc.call('verify-investigation', { id: task.id, version: completed.version, report: request.report, summary: 'Not a newer report' })).rejects.toThrow()
    await controller.update({ ...report(), packages: [] }, new Map())
    const current = identity(await dashboard.rpc.call('get-dashboard-state'))
    expect(await dashboard.rpc.call('get-investigation', { id: task.id })).toEqual(completed)
    const verification = dashboard.rpc.call('verify-investigation', { id: task.id, version: completed.version, report: current, summary: 'Human confirmed removal' })
    if (outcome === 'completed') {
      expect(await verification).toMatchObject({ status: 'verified', verification: { after: null, report: current } })
    }
    else {
      await expect(verification).rejects.toThrow()
    }
  })

  it('bounds records, rejects overflow without eviction of active work, and discards only the oldest terminal task', async () => {
    const { dashboard, request } = await host()
    const tasks: DashboardInvestigation[] = []
    for (let index = 0; index < 32; index++) {
      tasks.push(await dashboard.rpc.call('create-investigation', request))
    }
    await expect(dashboard.rpc.call('create-investigation', request)).rejects.toThrow('32 active')
    await dashboard.rpc.call('cancel-investigation', { id: tasks[1]!.id, version: 1 })
    const newest = await dashboard.rpc.call('create-investigation', request)
    const state = await dashboard.rpc.call('list-investigations')
    expect(state.items).toHaveLength(32)
    expect(state.items[0]?.id).toBe(tasks[0]!.id)
    expect(state.items.at(-1)?.id).toBe(newest.id)
    await expect(dashboard.rpc.call('get-investigation', { id: tasks[1]!.id })).rejects.toThrow('does not exist')
  })

  it('keeps one session through transport replacement and rejects disposed or foreign-controller operations', async () => {
    const { dashboard, controller, instance, task, claimToken, state, request } = await atStatus('claimed')
    await instance.close()
    const replacement = initDevframe(controller.definition, { auth: false, base: '/', sse: false, ws: false, mcp: false })
    hosts.push({ controller, instance: replacement })
    await replacement.ready
    const rpc = (await replacement.context).scope('weapp-vite').rpc
    expect((await rpc.call('get-dashboard-state')).sessionId).toBe(state.sessionId)
    expect(await rpc.call('propose-investigation', { id: task.id, version: task.version, claimToken, proposal })).toMatchObject({ status: 'proposed' })
    const fresh = await host()
    expect(fresh.state.sessionId).not.toBe(state.sessionId)
    await expect(fresh.dashboard.rpc.call('create-investigation', request)).rejects.toThrow('report is stale')
    await expect(fresh.dashboard.rpc.call('get-investigation', { id: task.id })).rejects.toThrow('does not exist')
    controller.dispose()
    await expect(rpc.call('list-investigations')).rejects.toThrow()
    await expect(rpc.call('get-investigation', { id: task.id })).rejects.toThrow()
    await expect(rpc.call('create-investigation', request)).rejects.toThrow()
    await expect(dashboard.rpc.call('start-investigation', { id: task.id, version: task.version, claimToken })).rejects.toThrow()
  })

  it('resolves exact report placements and preserves unknown, raw, compressed and attributed measurements', async () => {
    const { dashboard, request } = await host()
    for (const [target, evidence] of [
      [{ kind: 'package', packageId: 'main' }, { rawBytes: null, gzipBytes: null, brotliBytes: null, attributedBytes: null, sourceBytes: null }],
      [{ kind: 'artifact', packageId: 'main', file: 'app.js' }, { rawBytes: 100, gzipBytes: 50, brotliBytes: null, attributedBytes: null, sourceBytes: null }],
      [{ kind: 'module', packageId: 'main', file: 'app.js', moduleId: 'app' }, { rawBytes: null, attributedBytes: 60, sourceBytes: 90 }],
      [{ kind: 'module', packageId: 'main', file: 'app.js', moduleId: 'source-only' }, { attributedBytes: null, sourceBytes: null }],
    ] as const) {
      expect(await dashboard.rpc.call('create-investigation', { ...request, target })).toMatchObject({ evidence })
    }
    for (const target of [
      { kind: 'package', packageId: 'missing' },
      { kind: 'artifact', packageId: 'main', file: '../app.js' },
      { kind: 'module', packageId: 'main', file: 'unknown.js', moduleId: 'app' },
      { kind: 'module', packageId: 'main', file: 'unknown.js', moduleId: 'source-only' },
    ] as const) {
      await expect(dashboard.rpc.call('create-investigation', { ...request, target })).rejects.toThrow('report placement')
    }
    for (const invalid of [
      { ...request, report: { ...request.report, reportHash: '0'.repeat(64) } },
      { ...request, report: { ...request.report, revision: 1 } },
      { ...request, question: ' ' },
      { ...request, question: 'x'.repeat(4097) },
      { ...request, target: { ...request.target, file: '' } },
      { ...request, claimToken: 'not-an-owner-parameter' },
    ]) {
      await expect(dashboard.rpc.call('create-investigation', invalid)).rejects.toThrow()
    }
  })
})
