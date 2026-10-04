import { Buffer } from 'node:buffer'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'
import { aggregatePlan, verifyShard } from './aggregate.mjs'
import { createMatrix, frozenManifest, metricsForShard, policy, statusContext, targetKey } from './contract.mjs'
import { hmrProfileCapability } from './profileCapability.mjs'
import { publishComment, validatePlan } from './publish.mjs'

const target = { id: 'pr-7', prNumber: 7, headSha: 'a'.repeat(40), headRepository: 'owner/repo', baselineSha: policy.baselineSha }
const plan = { manifest: frozenManifest(), schemaVersion: 2, purpose: 'full', samplingContract: policy.samplingContract, driverSha: 'b'.repeat(40), repository: 'owner/repo', runId: '10', targets: [{ ...target, key: targetKey(target) }], reused: [], matrix: createMatrix([target]) }
function fixture(shard = 'hmr:classic:weapp-vite-template', os = 'ubuntu-latest') {
  const identity = { schemaVersion: 2, purpose: 'full', samplingContract: policy.samplingContract, driverSha: plan.driverSha, headSha: target.headSha, baselineSha: target.baselineSha, targetId: target.id, prNumber: 7, runId: '10', os, shard }
  const metrics: string[] = metricsForShard(shard)
  const count = shard === 'build' || shard === 'auto-build' ? 7 : 20
  const samples = Array.from({ length: count }, (_, round) => (round % 2 ? ['optimized', 'baseline'] : ['baseline', 'optimized']).map((side) => {
    const profileCapability = shard.startsWith('hmr:') ? hmrProfileCapability(side, side === 'baseline' ? target.baselineSha : target.headSha, shard.split(':')[1]!) : undefined
    return { round, side, profileCapability, values: metrics.map(id => ({ id, ms: side === 'baseline' ? 100 : 102, profileStatus: profileCapability?.status === 'unavailable' ? 'unavailable' : 'missing', output: { pageCount: 1, templateDigest: 'a'.repeat(64), configDigest: 'b'.repeat(64) } })) }
  })).flat()
  return { identity, report: { ...identity, baseline: { commit: target.baselineSha }, optimized: { commit: target.headSha }, manifest: { metrics }, executionPlan: { metrics, confirmation: [] as string[] }, primary: { errors: [] as string[], samples }, gate: { status: 'passed' } } }
}

it('recomputes performance from raw samples, rejects duplicate rounds, bad SHA and smoke evidence', () => {
  const { identity, report } = fixture()
  expect(verifyShard(report, identity).gate.status).toBe('passed')
  expect(() => verifyShard({ ...report, headSha: 'c'.repeat(40) }, identity)).toThrow('identity')
  expect(() => verifyShard({ ...report, purpose: 'smoke' }, identity)).toThrow('identity')
  expect(() => verifyShard({ ...report, baseline: { commit: 'd'.repeat(40) } }, identity)).toThrow('SHA mismatch')
  report.primary.samples.push(report.primary.samples[0]!)
  expect(() => verifyShard(report, identity)).toThrow('Duplicate')
})

it('keeps equal-sized confirmation regression and conflicting conclusions distinct', () => {
  const { identity, report } = fixture('hmr:stateful-experimental:weapp-vite-template')
  const id = report.manifest.metrics[0]!
  for (const row of report.primary.samples) {
    if (row.side === 'optimized') {
      row.values.find(v => v.id === id)!.ms = 110
    }
  }
  const confirmation = { errors: [], samples: report.primary.samples.map(r => ({ ...r, values: r.values.filter(v => v.id === id).map(v => ({ ...v })) })) }
  report.executionPlan.confirmation = [id]
  expect(verifyShard({ ...report, confirmation, gate: { status: 'regression' } }, identity).gate.status).toBe('regression')
  for (const row of confirmation.samples) {
    if (row.side === 'optimized') {
      row.values[0]!.ms = 99
    }
  }
  expect(verifyShard({ ...report, confirmation, gate: { status: 'unstable' } }, identity).gate.status).toBe('unstable')
  const baselineConfirmation = confirmation.samples.find(row => row.side === 'baseline')!
  const capability = baselineConfirmation.profileCapability
  baselineConfirmation.profileCapability = { ...capability!, runtime: 'classic' }
  expect(() => verifyShard({ ...report, confirmation, gate: { status: 'unstable' } }, identity)).toThrow('capability identity')
  baselineConfirmation.profileCapability = capability
  confirmation.samples.pop()
  expect(verifyShard({ ...report, confirmation, gate: { status: 'incomplete' } }, identity).gate.status).toBe('incomplete')
})

it('does not allow build output mismatches or missing lifecycle phases to pass', () => {
  const { identity, report } = fixture('build')
  report.primary.samples[1]!.values[0]!.output.templateDigest = 'c'.repeat(64)
  expect(() => verifyShard(report, identity)).toThrow('Stored gate')
  expect(verifyShard({ ...report, gate: { status: 'incomplete' } }, identity).gate.status).toBe('incomplete')
})

it('recomputes profile capability from frozen checkout identity without accepting forged exceptions', () => {
  const { identity, report } = fixture('hmr:stateful-experimental:weapp-vite-template')
  expect(verifyShard(report, identity).gate.status).toBe('passed')
  const baseline = report.primary.samples[0]!
  const candidate = report.primary.samples[1]!
  const original = baseline.profileCapability!
  for (const change of [{ commit: target.headSha }, { runtime: 'classic' }, { status: 'enabled' }, { reason: 'missing' }]) {
    baseline.profileCapability = { ...original, ...change }
    expect(() => verifyShard(report, identity)).toThrow('capability identity')
  }
  baseline.profileCapability = original
  for (const status of ['disabled', 'missing', 'available']) {
    baseline.values[0]!.profileStatus = status
    expect(() => verifyShard(report, identity)).toThrow('capability differs')
  }
  baseline.values[0]!.profileStatus = 'unavailable'
  Object.assign(baseline.values[0]!, { profile: { totalMs: 1 } })
  expect(() => verifyShard(report, identity)).toThrow('capability differs')
  Object.assign(baseline.values[0]!, { profile: undefined })
  candidate.values[0]!.profileStatus = 'unavailable'
  expect(() => verifyShard(report, identity)).toThrow('capability differs')
  candidate.values[0]!.profileStatus = 'disabled'
  expect(() => verifyShard(report, identity)).toThrow('capability differs')
})

it('does not convert baseline patch failures into passes or accept evidence from the old sampling contract', () => {
  const { identity, report } = fixture('hmr:stateful-experimental:weapp-vite-template')
  report.primary.errors.push('baseline: Timed out waiting for a stateful HMR patch batch')
  report.primary.samples[0]!.values = []
  expect(verifyShard({ ...report, gate: { status: 'incomplete' } }, identity).gate.status).toBe('incomplete')
  expect(() => verifyShard(report, identity)).toThrow('Stored gate')
  for (const samplingContract of ['paired-v2-template-shards', 'paired-v3-profile-capability']) {
    expect(() => verifyShard({ ...report, samplingContract }, identity)).toThrow('samplingContract')
  }
})

it('requires all 27 shards and does not average away a missing platform', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'performance-shards-'))
  try {
    for (const row of plan.matrix) {
      const dir = path.join(root, row.artifact)
      await mkdir(dir)
      await writeFile(path.join(dir, 'report.json'), JSON.stringify(fixture(row.shard, row.os).report))
    }
    expect((await aggregatePlan(plan, root)).targets[0].status).toBe('passed')
    const planFile = path.join(root, 'plan.json')
    await writeFile(planFile, JSON.stringify(plan))
    await promisify(execFile)(process.execPath, [path.join(import.meta.dirname, 'aggregate.mjs')], { cwd: root, env: { ...process.env, PERFORMANCE_PLAN: planFile, PERFORMANCE_ARTIFACTS: root } })
    const persisted = JSON.parse(await readFile(path.join(root, 'nightly-report.json'), 'utf8'))
    expect(persisted.targets[0].status).toBe('passed')
    await rm(path.join(root, plan.matrix.at(-1)!.artifact), { recursive: true })
    expect((await aggregatePlan(plan, root)).targets[0].status).toBe('incomplete')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('rejects forged planner metadata and refuses to overwrite a newer PR HEAD', async () => {
  expect(() => validatePlan(plan, { id: 10, head_sha: plan.driverSha }, 'owner/repo')).not.toThrow()
  expect(() => validatePlan({ ...plan, driverSha: 'c'.repeat(40) }, { id: 10, head_sha: plan.driverSha }, 'owner/repo')).toThrow('provenance')
  const calls: string[] = []
  const get = async (endpoint: string) => {
    calls.push(endpoint)
    return { state: 'open', head: { sha: 'c'.repeat(40) } }
  }
  expect(await publishComment(target, 'do not publish', get)).toBe(false)
  expect(calls).toEqual(['/pulls/7'])
})

it('finishes a registered v3 attempt after migration without mixing v4 shards or replacing its comment', async () => {
  const samplingContract = 'paired-v3-profile-capability'
  const historicalPlan = { ...plan, samplingContract, targets: [{ ...target, key: targetKey(target, samplingContract) }] }
  const run = { id: 10, name: 'Nightly Performance', event: 'workflow_dispatch', path: '.github/workflows/nightly-performance.yml', head_sha: plan.driverSha, head_branch: 'main', head_repository: { full_name: plan.repository }, html_url: 'https://github.com/owner/repo/actions/runs/10' }
  const context = statusContext(target, samplingContract)
  const writes: Array<{ context: string, state: string, target_url: string }> = []
  const unexpected: string[] = []
  const server = createServer(async (req, res) => {
    const endpoint = req.url?.replace(`/repos/${plan.repository}`, '').split('?')[0]
    let response: unknown = {}
    if (endpoint === '/actions/runs/10') {
      response = run
    }
    else if (endpoint === '') {
      response = { default_branch: 'main' }
    }
    else if (endpoint === `/commits/${target.headSha}/statuses`) {
      response = [{ context, target_url: run.html_url, creator: { type: 'Bot' } }]
    }
    else if (endpoint === `/statuses/${target.headSha}` && req.method === 'POST') {
      const chunks: Buffer[] = []
      for await (const chunk of req) {
        chunks.push(chunk)
      }
      writes.push(JSON.parse(Buffer.concat(chunks).toString()) as typeof writes[number])
    }
    else {
      unexpected.push(`${req.method} ${endpoint}`)
      res.statusCode = 404
    }
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(response))
  })
  const root = await mkdtemp(path.join(os.tmpdir(), 'performance-contract-migration-'))
  try {
    expect(context).not.toBe(statusContext(target))
    expect(() => validatePlan(historicalPlan, run, plan.repository)).not.toThrow()
    expect(() => validatePlan({ ...historicalPlan, targets: plan.targets }, run, plan.repository)).toThrow('Invalid planned target')
    expect(() => validatePlan({ ...historicalPlan, samplingContract: 'untrusted-contract' }, run, plan.repository)).toThrow('provenance')
    for (const row of plan.matrix) {
      const directory = path.join(root, row.artifact)
      await mkdir(directory)
      await writeFile(path.join(directory, 'report.json'), JSON.stringify({ ...fixture(row.shard, row.os).report, samplingContract }))
    }
    expect((await aggregatePlan(historicalPlan, root)).targets[0].status).toBe('passed')
    const planDirectory = path.join(root, 'performance-plan')
    await mkdir(planDirectory)
    await writeFile(path.join(planDirectory, 'plan.json'), JSON.stringify(historicalPlan))
    const eventFile = path.join(root, 'event.json')
    await writeFile(eventFile, JSON.stringify({ workflow_run: { id: run.id } }))
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Missing test server address')
    }
    await promisify(execFile)(process.execPath, [path.join(import.meta.dirname, 'publish.mjs')], {
      cwd: root,
      env: { ...process.env, GITHUB_EVENT_PATH: eventFile, GITHUB_REPOSITORY: plan.repository, GITHUB_TOKEN: 'test-only', GITHUB_API_URL: `http://127.0.0.1:${address.port}`, PERFORMANCE_ARTIFACTS: root },
      timeout: 10_000,
    })
    expect(writes).toMatchObject([{ context, state: 'success', target_url: run.html_url }])
    expect(unexpected).toEqual([])
    const mixed = plan.matrix[0]!
    await writeFile(path.join(root, mixed.artifact, 'report.json'), JSON.stringify(fixture(mixed.shard, mixed.os).report))
    const report = await aggregatePlan(historicalPlan, root)
    expect(report.targets[0].status).toBe('incomplete')
    expect(report.targets[0].systems[0].parts[0].errors).toContain('Error: Shard identity mismatch: samplingContract')
  }
  finally {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
    await rm(root, { recursive: true, force: true })
  }
})

it('updates late smoke status without replacing completed full evidence', async () => {
  let saved = ''
  const get = async (endpoint: string, body?: { body: string }) => {
    if (endpoint === '/pulls/7') {
      return { state: 'open', head: { sha: target.headSha } }
    }
    if (endpoint.startsWith('/issues/7/comments')) {
      return [{ id: 1, user: { type: 'Bot' }, body: `<!-- performance-v2 -->\nHEAD: \`${target.headSha}\`\nPR 正确性冒烟：运行中。\n完整性能：已完成，🔴 regression。\n| ubuntu | regression |` }]
    }
    if (endpoint === '/issues/comments/1') {
      saved = body!.body
      return {}
    }
    throw new Error(endpoint)
  }
  await publishComment(target, 'must not replace full evidence', get, '✅ 正确性冒烟通过')
  expect(saved).toContain('PR 正确性冒烟：✅ 正确性冒烟通过。')
  expect(saved).toContain('| ubuntu | regression |')
  expect(saved).not.toContain('must not replace')
})
