import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowJob {
  if?: string
  needs?: string | string[]
  strategy?: { matrix: { 'os'?: string[], 'node-version'?: number[], 'shard'?: number[], 'include'?: Array<{ 'os': string, 'node-version': number }> } }
  with?: Record<string, unknown>
}

async function workflow() {
  return parse(await readFile(new URL('../.github/workflows/ci-e2e.yml', import.meta.url), 'utf8')) as {
    on: { workflow_dispatch: { inputs: Record<string, { default: string, options: string[] }> } }
    concurrency: { group: string }
    jobs: Record<string, WorkflowJob>
  }
}

describe('bounded HMR workflow diagnosis', () => {
  it('requires an explicit manual selection and uses a separate concurrency group', async () => {
    const config = await workflow()
    expect(config.on.workflow_dispatch.inputs['hmr-diagnostic']).toMatchObject({ default: 'full', options: ['full', 'shared-layout-windows', 'lifecycle'] })
    expect(config.concurrency.group).toContain('inputs.hmr-diagnostic || \'full\'')
    const job = config.jobs['shared-layout-windows-diagnostic']!
    expect(job.if).toBe('github.event_name == \'workflow_dispatch\' && inputs.hmr-diagnostic == \'shared-layout-windows\'')
    expect(job.strategy?.matrix).toEqual({ 'node-version': [22, 24] })
    expect(job.with).toMatchObject({
      runs_on: 'windows-latest',
      build_command: 'pnpm build:pkgs:ci:windows',
      main_command: 'pnpm vitest run -c e2e/vitest.e2e.ci.config.ts e2e/ci/hmr-layout-shared-template-wxs.test.ts',
      timeout_minutes: 30,
    })
  })

  it('runs lifecycle regressions serially on each OS and retains failure diagnostics', async () => {
    const { jobs } = await workflow()
    const job = jobs['lifecycle-diagnostic']!
    expect(job.if).toBe('github.event_name == \'workflow_dispatch\' && inputs.hmr-diagnostic == \'lifecycle\'')
    expect(job.strategy?.matrix).toEqual({ 'os': ['ubuntu-latest', 'windows-latest', 'macos-latest'], 'node-version': [22, 24] })
    const commands = String(job.with?.main_command).trim().split('\n')
    expect(commands).toHaveLength(2)
    expect(commands[0]).toContain('snapshotBuild.integration.test.ts')
    expect(commands[0]).toContain('processTree.test.ts')
    expect(commands[0]).toContain('processTree.windows.integration.test.ts')
    expect(commands[1]).toContain('-c e2e/vitest.e2e.ci.config.ts e2e/ci/edit-sequence.test.ts')
    expect(commands[1]).toContain('--outputFile=.tmp/hmr-lifecycle-report.json')
    expect(job.with?.artifact_path).toBe('.tmp/hmr-lifecycle-report.json')
    expect(jobs['shared-compiler-hosts']?.if).toContain('(!inputs.hmr-diagnostic || inputs.hmr-diagnostic == \'full\')')
  })

  it('keeps every full OS/Node/shard combination and excludes unrelated manual work', async () => {
    const { jobs } = await workflow()
    expect(jobs['miniapp-e2e-ci-full']?.strategy?.matrix).toEqual({ 'os': ['ubuntu-latest', 'windows-latest', 'macos-latest'], 'node-version': [22, 24], 'shard': [1, 2, 3, 4] })
    const expected = ['macos-latest/22', 'macos-latest/24', 'ubuntu-latest/22', 'ubuntu-latest/24', 'windows-latest/22', 'windows-latest/24']
    for (const name of ['miniapp-e2e-build-full', 'miniapp-hmr-ci-full']) {
      expect(jobs[name]?.strategy?.matrix.include?.map(row => `${row.os}/${row['node-version']}`).sort()).toEqual(expected)
    }
    for (const [name, job] of Object.entries(jobs)) {
      if (['shared-layout-windows-diagnostic', 'lifecycle-diagnostic'].includes(name)) {
        continue
      }
      expect(job.if, `${name} must stay outside a bounded diagnostic run`).toSatisfy((condition: string) =>
        condition.includes('!inputs.hmr-diagnostic || inputs.hmr-diagnostic == \'full\'')
        || condition.includes('github.event_name == \'pull_request\'')
        || condition.includes('needs.miniapp-e2e-build-full.result == \'success\''),
      )
    }
  })
})
