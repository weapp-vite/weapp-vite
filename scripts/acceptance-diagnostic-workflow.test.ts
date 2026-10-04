/* eslint-disable no-template-curly-in-string -- GitHub Actions 表达式必须按字面量核验。 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { parse } from 'yaml'

interface Workflow {
  on: { workflow_dispatch: { inputs: { scope: { default: string, options: string[] } } } }
  concurrency: { group: string }
  jobs: Record<string, {
    if: string
    strategy: { 'fail-fast': boolean, 'matrix': { 'node-version': number[] } }
    uses: string
    with: Record<string, string | number>
  }>
}

const workflowPath = fileURLToPath(new URL('../.github/workflows/ci-acceptance.yml', import.meta.url))
const workflow = parse(readFileSync(workflowPath, 'utf8')) as Workflow

it('isolates manual Windows acceptance diagnostics from the complete compatibility run', () => {
  expect(workflow.on.workflow_dispatch.inputs.scope).toMatchObject({
    default: 'full',
    options: ['full', 'windows-runtime-diagnostic'],
  })
  expect(workflow.concurrency.group).toBe('acceptance-${{ inputs.scope || \'full\' }}-${{ github.ref }}')
  expect(workflow.jobs.compatibility?.if).toBe('github.event_name != \'workflow_dispatch\' || inputs.scope == \'full\'')
  expect(workflow.jobs['windows-runtime-diagnostic']?.if).toBe('github.event_name == \'workflow_dispatch\' && inputs.scope == \'windows-runtime-diagnostic\'')
})

it('rebuilds dependencies and retains coverage and the original test timeout on both Windows Node versions', () => {
  const job = workflow.jobs['windows-runtime-diagnostic']!
  expect(job.uses).toBe('./.github/workflows/reusable-node-command.yml')
  expect(job.strategy).toMatchObject({ 'fail-fast': false, 'matrix': { 'node-version': [22, 24] } })
  expect(job.with).toMatchObject({
    runs_on: 'windows-latest',
    node_version: '${{ matrix.node-version }}',
    build_command: 'pnpm exec turbo run build --filter=@weapp-agent/mini-program...',
    artifact_name: 'acceptance-runtime-windows-node-${{ matrix.node-version }}-${{ github.sha }}',
    artifact_path: '.tmp/acceptance-runtime-report.json',
  })
  expect(String(job.with.main_command).trim().split('\n')).toEqual([
    'pnpm --filter @weapp-agent/mini-program typecheck',
    'pnpm --filter @weapp-agent/mini-program exec vitest run --configLoader bundle --coverage.enabled --maxWorkers=50% test/acceptance.test.ts --reporter=default --reporter=json --outputFile=../../.tmp/acceptance-runtime-report.json',
  ])
})
