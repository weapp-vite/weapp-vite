import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { auditRunEvidence, BASELINE_SHA, CANDIDATE_SHA, TRACE_FILTER } from './hmrNativeEventDiagnostic.mjs'

const temporaryDirectories = []
const input = { id: 'weapp-vite-wevu-template' }
const sha256 = value => createHash('sha256').update(value).digest('hex')

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

async function terminalFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hmr-native-terminal-'))
  temporaryDirectories.push(directory)
  const manifest = { 'src/pages/index/index.vue': sha256('original source') }
  const devLog = `logs/${input.id}.dev.log`
  const rawLog = [
    '\u001B[32mraw event: Event { kind: Modify }\u001B[0m',
    '[BundleCoordinator] received message\n - message: WatchEvent(\n    [\n        DebouncedEvent { ... }\n    ]\n)',
    '[BundleCoordinator] scheduling new build task',
    '[BundlingTask] starts to run.',
    '[BundlingTask] starts to generate HMR updates',
    '[BundlingTask] completed generating HMR updates',
    '',
  ].join('\n')
  const original = {
    iterations: 2,
    sampleMode: 'edit-only',
    budgetMs: 500,
    timeoutMs: 30_000,
    profileTimeoutMs: 15_000,
    markerSeed: 'hmr-attribution-primary-0',
    outputScopeEnabled: true,
    profileEnabled: false,
    templates: [{
      id: input.id,
      devLog,
      scenarios: ['vue-page-json-macro', 'vue-page-template', 'vue-page-script', 'vue-page-style'].map(id => ({
        id,
        sourceFile: `workspace/${input.id}/src/pages/index/index.vue`,
        cycles: [0, 1].map(() => ({ restore: { inputSha256: manifest['src/pages/index/index.vue'] } })),
      })),
    }],
  }
  const samples = original.templates[0].scenarios.flatMap(row => ['first', 'repeat'].flatMap(cycle => ['edit', 'restore'].map(phase => ({
    id: `${input.id}:${row.id}:${cycle}:${phase}`,
    inputSha256: phase === 'restore' ? manifest['src/pages/index/index.vue'] : sha256(`${row.id}/${cycle}`),
  }))))
  const run = { round: 0, input: input.id, markerSeed: original.markerSeed, side: 'baseline', samples, inputDigest: sha256(JSON.stringify(manifest)) }
  await mkdir(path.join(directory, 'logs'))
  await writeFile(path.join(directory, devLog), rawLog)
  await writeFile(path.join(directory, 'report.json'), JSON.stringify(original))
  await writeFile(path.join(directory, 'input-manifest.json'), JSON.stringify(manifest))
  return { directory, manifest, original, run, rawLog }
}

describe('native event diagnostic resource contract', () => {
  it('requires post-stop evidence and restored source hashes, while retaining the original ANSI log', async () => {
    const fixture = await terminalFixture()
    const audit = await auditRunEvidence(fixture.directory, fixture.run, input, fixture.manifest)
    expect(audit).toMatchObject({ resourcesTerminal: true, devLogSha256: sha256(fixture.rawLog), taskAssociation: expect.stringContaining('unknown') })
    expect(Object.values(audit.trace)).toEqual(['observed', 'observed', 'observed'])
    expect(await readFile(path.join(fixture.directory, audit.devLog), 'utf8')).toBe(fixture.rawLog)
    fixture.original.templates[0].scenarios[0].cycles[1].restore.inputSha256 = sha256('unfinished restore')
    await writeFile(path.join(fixture.directory, 'report.json'), JSON.stringify(fixture.original))
    await expect(auditRunEvidence(fixture.directory, fixture.run, input, fixture.manifest)).rejects.toThrow('restoration')
  })

  it.each(['error', 'stop', 'retainedInput'])('does not infer resource terminal from complete samples when %s is present', async (field) => {
    const fixture = await terminalFixture()
    await expect(auditRunEvidence(fixture.directory, { ...fixture.run, [field]: 'original failure' }, input, fixture.manifest)).rejects.toThrow('resource cleanup')
  })

  it('rejects cleanup failure artifacts independently of samples and successful-looking reports', async () => {
    const fixture = await terminalFixture()
    const failure = path.join(fixture.directory, 'failures', input.id, 'cleanup')
    await mkdir(failure, { recursive: true })
    await writeFile(path.join(failure, 'report.json'), '{"error":"stop failed"}')
    await expect(auditRunEvidence(fixture.directory, fixture.run, input, fixture.manifest)).rejects.toThrow('cleanup failure')
  })

  it('rejects a duplicate sample even when the total sample count remains sixteen', async () => {
    const fixture = await terminalFixture()
    fixture.run.samples[1] = fixture.run.samples[0]
    await expect(auditRunEvidence(fixture.directory, fixture.run, input, fixture.manifest)).rejects.toThrow('unique original sample IDs')
  })
})

it('keeps native event diagnostics manual, serial, frozen and separate from performance acceptance', async () => {
  const config = parse(await readFile(new URL('../.github/workflows/hmr-native-event-diagnostic.yml', import.meta.url), 'utf8'))
  expect(Object.keys(config.on)).toEqual(['workflow_dispatch'])
  expect(config.on.workflow_dispatch.inputs['controller-sha']).toMatchObject({ required: true, type: 'string' })
  expect(config.concurrency).toEqual({ 'group': 'hmr-native-event-diagnostic', 'cancel-in-progress': false })
  expect(Object.keys(config.jobs)).toEqual(['diagnose'])
  const job = config.jobs.diagnose
  expect(job['runs-on']).toBe('ubuntu-24.04')
  expect(job.strategy).toBeUndefined()
  const checkouts = job.steps.filter(step => step.uses?.startsWith('actions/checkout@'))
  expect(checkouts.map(step => [step.with.path, step.with.ref])).toEqual([
    ['tools', `\${{ github.sha }}`],
    ['baseline', BASELINE_SHA],
    ['candidate', CANDIDATE_SHA],
  ])
  expect(job.steps.find(step => step.uses?.startsWith('actions/setup-node@')).with['node-version']).toBe('24.18.0')
  expect(job.steps.filter(step => step.run === 'pnpm install --frozen-lockfile').map(step => step['working-directory'])).toEqual(['baseline', 'candidate'])
  const collect = job.steps.find(step => step.name === 'Collect the original sequences with native event tracing')
  expect(collect.env).toEqual({ RD_LOG_OUTPUT: 'readable', RD_LOG: TRACE_FILTER })
  expect(collect['working-directory']).toBe('candidate')
  expect(collect.run).toContain('node --import tsx "$TOOLS_ROOT/scripts/hmrNativeEventDiagnostic.mjs"')
  expect(collect.run).toContain('> "$REPORT_ROOT/driver.log" 2>&1')
  expect(collect.run).not.toContain('tee')
  const artifact = job.steps.find(step => step.uses?.startsWith('actions/upload-artifact@'))
  expect(artifact.if).toBe('always() && steps.sanitize-driver.outputs.safe == \'true\'')
  const sanitize = job.steps.find(step => step.id === 'sanitize-driver')
  expect(sanitize.if).toBe('always()')
  expect(sanitize.run).toContain('sanitizeAcceptanceText(raw, [process.env.TOOLS_ROOT')
  expect(sanitize.run).toContain('await rm(file)')
  expect(artifact.with).toMatchObject({ 'path': `\${{ runner.temp }}/hmr-native-event-diagnostic`, 'retention-days': 90 })
  const source = await readFile(new URL('./hmrNativeEventDiagnostic.mjs', import.meta.url), 'utf8')
  expect(source).toContain('collectAcceptanceRun(options, side, input, 0, \'primary\', deadline)')
  expect(source).toContain('const input = contract.HMR_INPUTS[0]')
  expect(source).toContain('kind: \'diagnostic\', performanceVerdict: false')
  expect(source).not.toMatch(/evaluateGate|pairAcceptanceRuns|runHmrAttributionAcceptance|collectAcceptanceBatch|HMR_ACCEPTANCE_PAIRS|MAX_SCENARIOS/)
})
