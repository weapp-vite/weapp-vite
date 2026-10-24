/* eslint-disable no-template-curly-in-string -- GitHub Actions 表达式是待验证的字面量，不是 JavaScript 插值。 */
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { readWorkflowFixture } from '../workflowFixture.mjs'

interface WorkflowStep {
  name?: string
  uses?: string
  run?: string
  if?: string
  with?: Record<string, unknown>
}

interface WorkflowJob {
  needs?: string[]
  if?: string
  env?: Record<string, string>
  strategy?: { 'fail-fast': boolean, 'matrix': { shard: number[] } }
  with?: Record<string, unknown>
  steps?: WorkflowStep[]
}

function workflow() {
  return readWorkflowFixture('reusable-miniapp-platform.yml') as { jobs: Record<string, WorkflowJob> }
}

describe('complete headless DOM workflow sharding', () => {
  it('freezes an independent headless plan for the same checkout, platform and exclusions', () => {
    const { jobs } = workflow()
    const plan = jobs.plan!
    expect(plan.env).toMatchObject({
      BUILD_ARTIFACT_EXPECTED_COMMIT: '${{ needs.pr-context.outputs.checkout_sha }}',
      WEAPP_VITE_E2E_EXCLUDE_PROJECTS: '${{ inputs.exclude_projects }}',
      WEAPP_VITE_VERIFICATION_TOPOLOGY: '${{ inputs.verification_topology }}',
    })
    const profiles = plan.steps!.find(step => step.name === 'Create runner profiles')!.run!
    expect(profiles).toContain('provider: \'none\'')
    expect(profiles).toContain('platform: \'weapp\'')
    expect(profiles).toContain('fs.writeFileSync(\'.tmp/verification-plan/headless-profile.json\', JSON.stringify({ ...profile, provider: \'headless\' }))')
    const commands = plan.steps!.find(step => step.name === 'Freeze complete task inventory and shard assignment')!.run!
    expect(commands).toContain('plan --suite=ci-${{ inputs.mode }}:classic --shards=4 --profile=.tmp/verification-plan/profile.json')
    expect(commands).toContain('history --input=.tmp/verification-history --profile=.tmp/verification-plan/headless-profile.json')
    expect(commands).toContain('plan --suite=ide-dom-headless:classic --shards=2 --profile=.tmp/verification-plan/headless-profile.json --history=.tmp/verification-plan/headless-history.json --output=.tmp/verification-plan/ide-dom-headless.json')
    expect(jobs.miniapp!.with!.main_command).toBe('node --import tsx e2e/scripts/run-e2e-suite.ts ci-${{ inputs.mode }}:classic --plan=.tmp/verification-plan/plan.json --shard-index=${{ matrix.shard }}')
  })

  it('keeps the original job budget and Windows cleanup checks while consuming every frozen shard', () => {
    const { jobs } = workflow()
    const job = jobs['ide-dom-headless']!
    expect(job.needs).toEqual(['pr-context', 'build', 'plan'])
    expect(job.strategy).toEqual({ 'fail-fast': false, 'matrix': { shard: [1, 2] } })
    expect(job.with).toMatchObject({
      timeout_minutes: 30,
      checkout_ref: '${{ needs.pr-context.outputs.checkout_sha }}',
      e2e_exclude_projects: '${{ inputs.exclude_projects }}',
      consume_build_artifact: jobs.build!.with!.build_artifact_name,
      consume_aux_artifact: 'miniapp-plan-${{ inputs.runs_on }}-node-${{ inputs.node_version }}-${{ inputs.mode }}',
      aux_artifact_path: '.tmp/verification-plan',
      artifact_name: 'ide-dom-headless-${{ inputs.runs_on }}-node-${{ inputs.node_version }}-shard-${{ matrix.shard }}',
      timing_artifact_name: 'timing-ide-dom-headless-${{ inputs.runs_on }}-${{ inputs.node_version }}-${{ inputs.mode }}-${{ matrix.shard }}',
    })
    const commands = String(job.with!.main_command).trim().split('\n')
    const cleanupCommand = commands.find(command => command.includes('pnpm vitest run'))!
    const runtimeCommand = commands.find(command => command.includes('e2e/scripts/run-e2e-suite.ts'))!
    expect(commands.filter(command => command.includes('pnpm vitest run'))).toHaveLength(1)
    expect(commands.filter(command => command.includes('e2e/scripts/run-e2e-suite.ts'))).toHaveLength(1)
    const preparationIndex = commands.findIndex(command => command.includes('mkdirSync(\'.tmp/ide-dom-headless-preflight\''))
    expect(preparationIndex).toBeGreaterThanOrEqual(0)
    expect(preparationIndex).toBeLessThan(commands.indexOf(cleanupCommand))
    expect(commands.indexOf(cleanupCommand)).toBeLessThan(commands.indexOf(runtimeCommand))
    for (const name of ['windowsKernelQuery', 'processes', 'windowsProcessTree', 'windowsProcessRows', 'windowsQueryTrace']) {
      expect(cleanupCommand).toContain(`e2e/utils/devProcessCleanup/${name}.test.ts`)
    }
    expect(cleanupCommand).toContain('WEAPP_VITE_E2E_CLEANUP_TRACE=1')
    expect(cleanupCommand).toContain('e2e/utils/dev-process.cleanup.test.ts')
    expect(cleanupCommand).toContain('2>&1 | tee .tmp/ide-dom-headless-preflight/cleanup.log')
    expect(runtimeCommand).toContain('node --import tsx e2e/scripts/run-e2e-suite.ts ide-dom-headless:classic --plan=.tmp/verification-plan/ide-dom-headless.json --shard-index=${{ matrix.shard }}')
    for (const setting of ['WEAPP_VITE_E2E_CLEANUP_TRACE=1', 'WEAPP_VITE_E2E_DEV_PROCESS_TRACE=1', 'WEAPP_VITE_E2E_DEV_SHUTDOWN_TRACE=1', 'WEAPP_VITE_E2E_DOM_SCOPE_TRACE_CHECKPOINTS=home-ready']) {
      expect(runtimeCommand).toContain(setting)
    }
    expect(String(job.with!.artifact_path).trim().split('\n')).toEqual([
      'docs/reports/dom-acceptance/**',
      '.tmp/ide-dom-headless-preflight/**',
      'docs/reports/*-ide-warning-report/dev-process/**',
      'docs/reports/*-e2e-ide-dom-headless-*-suite-report/**',
    ])
    expect(job.with!.verification_telemetry).toBeUndefined()
  })

  it('requires strict aggregation of both complete evidence artifacts after ordinary failures', () => {
    const { jobs } = workflow()
    const job = jobs['ide-dom-headless-aggregate']!
    expect(job.needs).toEqual(['pr-context', 'build', 'plan', 'ide-dom-headless'])
    expect(job.if).toBe('${{ !cancelled() && needs.build.result == \'success\' && needs.plan.result == \'success\' }}')
    expect(job.env).toMatchObject({
      BUILD_ARTIFACT_EXPECTED_COMMIT: '${{ needs.pr-context.outputs.checkout_sha }}',
      WEAPP_VITE_VERIFICATION_TOPOLOGY: '${{ inputs.verification_topology }}',
    })
    const downloads = job.steps!.filter(step => step.uses?.startsWith('actions/download-artifact@'))
    expect(downloads.map(step => step.with)).toEqual([
      { name: jobs['ide-dom-headless']!.with!.consume_aux_artifact, path: '.tmp/verification-plan' },
      { pattern: 'ide-dom-headless-${{ inputs.runs_on }}-node-${{ inputs.node_version }}-shard-*', path: '.tmp/ide-dom-headless-reports' },
    ])
    expect(job.steps!.find(step => step.name === 'Validate complete headless DOM inventory and evidence')!.run).toBe('node --import tsx e2e/scripts/verification/cli.ts aggregate --plan=.tmp/verification-plan/ide-dom-headless.json --reports=.tmp/ide-dom-headless-reports --output=.tmp/ide-dom-headless-aggregate/report.json')
    const upload = job.steps!.find(step => step.name === 'Upload complete headless DOM verdict')!
    expect(upload.if).toBe('${{ !cancelled() }}')
    expect(upload.with).toMatchObject({ 'path': '.tmp/ide-dom-headless-aggregate', 'if-no-files-found': 'error' })
  })

  it('retains the separate original baseline telemetry command and provider inventory', async () => {
    const value: unknown = JSON.parse(await readFile(new URL('../verificationTelemetry/baseline-topology.json', import.meta.url), 'utf8'))
    const baseline = value as Record<string, Record<string, WorkflowJob>>
    const job = baseline['.github/workflows/validate-ci-e2e.yml']!['ide-dom-headless']!
    expect(job.with!.verification_telemetry).toBe(true)
    expect(job.with!.timeout_minutes).toBe(30)
    expect(String(job.with!.main_command).trim().split('\n').at(-1)).toBe('pnpm exec cross-env WEAPP_VITE_E2E_CLEANUP_TRACE=1 node --import tsx e2e/scripts/run-e2e-suite.ts ide-dom-headless')
    expect(String(job.with!.main_command)).not.toContain('--plan=')
  })
})
