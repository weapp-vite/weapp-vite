import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowJob {
  if?: string
  needs?: string | string[]
  strategy?: { 'fail-fast'?: boolean, 'matrix': { 'os'?: string[], 'node-version'?: number[], 'shard'?: number[], 'include'?: Array<{ 'os': string, 'node-version': number }> } }
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
    expect(config.on.workflow_dispatch.inputs['hmr-diagnostic']).toMatchObject({ default: 'full', options: ['full', 'shared-layout-windows', 'lifecycle', 'runtime-publication', 'plugin-watch-readiness', 'workspace-hmr', 'windows-process-narrow'] })
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
    const workspaceHmr = config.jobs['workspace-hmr-nightly']!
    expect(workspaceHmr.if).toContain('inputs.hmr-diagnostic == \'workspace-hmr\'')
    expect(workspaceHmr.with).toMatchObject({
      main_command: 'pnpm audit:hmr:nightly',
      artifact_name: 'workspace-hmr-nightly',
      timeout_minutes: 120,
    })
  })

  it('keeps the process lifecycle diagnostic manual and scoped to Windows Node 22 and 24', async () => {
    const { jobs } = await workflow()
    const job = jobs['windows-process-narrow-diagnostic']!
    expect(job.if).toBe('github.event_name == \'workflow_dispatch\' && inputs.hmr-diagnostic == \'windows-process-narrow\'')
    expect(job.needs).toBeUndefined()
    expect(job.strategy?.['fail-fast']).toBe(false)
    expect(job.strategy?.matrix).toEqual({ 'node-version': [22, 24] })
    expect(job.with).toMatchObject({
      runs_on: 'windows-latest',
      build_command: 'pnpm exec turbo run build --filter=weapp-ide-cli...',
      main_command: 'pnpm vitest run -c e2e/vitest.e2e.internal.config.ts e2e/scripts/suiteRunner/process.test.ts --maxWorkers=1 --no-file-parallelism --reporter=default --reporter=json --outputFile=.tmp/windows-process-narrow-report.json',
      artifact_name: expect.stringMatching(/^windows-process-narrow-.*matrix\.node-version.*github\.sha/),
      artifact_path: '.tmp/windows-process-narrow-report.json',
      timeout_minutes: 15,
    })
  })

  it('isolates plugin watch readiness from broader regressions on every OS and Node version', async () => {
    const { jobs } = await workflow()
    const job = jobs['plugin-watch-readiness-diagnostic']!
    expect(job.if).toBe('github.event_name == \'workflow_dispatch\' && inputs.hmr-diagnostic == \'plugin-watch-readiness\'')
    expect(job.needs).toBeUndefined()
    expect(job.strategy?.['fail-fast']).toBe(false)
    expect(job.strategy?.matrix).toEqual({ 'os': ['ubuntu-latest', 'windows-latest', 'macos-latest'], 'node-version': [22, 24] })
    expect(job.with).toMatchObject({
      build_command: 'pnpm exec turbo run build --filter=weapp-vite...',
      main_command: 'pnpm vitest run packages/weapp-vite/test/vite-plugin-project.test.ts --reporter=default --reporter=json --outputFile=.tmp/plugin-watch-readiness-report.json',
      artifact_name: expect.stringMatching(/^plugin-watch-readiness-.*matrix\.os.*matrix\.node-version.*github\.sha/),
      artifact_path: '.tmp/plugin-watch-readiness-report.json',
      timeout_minutes: 20,
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
    expect(commands[0]).toContain('scripts/utils/atomicRename.test.ts')
    expect(commands[0]).toContain('scripts/editSequence/buildSources.test.ts')
    expect(commands[0]).toContain('scripts/editSequence/frameworkSources.test.ts')
    expect(commands[1]).toContain('-c e2e/vitest.e2e.ci.config.ts e2e/ci/edit-sequence.test.ts')
    expect(commands[1]).toContain('--outputFile=.tmp/hmr-lifecycle-report.json')
    expect(job.with?.artifact_path).toBe('.tmp/hmr-lifecycle-report.json')
    expect(jobs['shared-compiler-hosts']?.if).toContain('(!inputs.hmr-diagnostic || inputs.hmr-diagnostic == \'full\')')
  })

  it('runs publication regressions only when requested across the full OS and Node matrix', async () => {
    const { jobs } = await workflow()
    const job = jobs['runtime-publication-diagnostic']!
    expect(job.if).toBe('github.event_name == \'workflow_dispatch\' && inputs.hmr-diagnostic == \'runtime-publication\'')
    expect(job.strategy?.matrix).toEqual({ 'os': ['ubuntu-latest', 'windows-latest', 'macos-latest'], 'node-version': [22, 24] })
    const commands = String(job.with?.main_command)
    for (const file of ['scripts/utils/atomicRename.test.ts', 'scripts/editSequence/buildSources.test.ts', 'scripts/editSequence/frameworkSources.test.ts', 'devBuildCompletion.test.ts', 'hmrOutputDiagnostics.test.ts', 'statefulArtifactMeasurement.deadline.test.ts', 'auto-import-vue-sfc.test.ts', 'external-linked-vue-component.hmr.test.ts', 'issue-1134-native-topology.runtime.test.ts', 'script-setup-external-src.runtime.test.ts', 'issue-1015-css-hmr.runtime.test.ts', 'issue-1140-mode-cache.runtime.test.ts', 'issue-1058-template-tags.runtime.test.ts']) {
      expect(commands).toContain(file)
    }
    expect(commands).toContain('WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless WEAPP_VITE_E2E_DOM_ACCEPTANCE=1')
    expect(commands).toContain('-c e2e/vitest.e2e.headless.config.ts')
    expect(job.with?.artifact_path).toBe('docs/reports/dom-acceptance/**')
  })

  it('keeps every full OS/Node/shard combination and excludes unrelated manual work', async () => {
    const { jobs } = await workflow()
    expect(jobs['miniapp-e2e-ci-full']?.strategy?.matrix).toEqual({ 'os': ['ubuntu-latest', 'windows-latest', 'macos-latest'], 'node-version': [22, 24], 'shard': [1, 2, 3, 4] })
    const expected = ['macos-latest/22', 'macos-latest/24', 'ubuntu-latest/22', 'ubuntu-latest/24', 'windows-latest/22', 'windows-latest/24']
    for (const name of ['miniapp-e2e-build-full', 'miniapp-hmr-ci-full']) {
      expect(jobs[name]?.strategy?.matrix.include?.map(row => `${row.os}/${row['node-version']}`).sort()).toEqual(expected)
    }
    for (const [name, job] of Object.entries(jobs)) {
      if (['shared-layout-windows-diagnostic', 'lifecycle-diagnostic', 'runtime-publication-diagnostic', 'plugin-watch-readiness-diagnostic', 'windows-process-narrow-diagnostic'].includes(name)) {
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
