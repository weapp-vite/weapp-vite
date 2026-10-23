/* eslint-disable no-template-curly-in-string -- GitHub Actions 表达式必须按字面量核验。 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_TEMPLATE_NAMES } from '../../../scripts/createWeappViteSmoke/templates.mjs'
import { readWorkflowGraph } from '../../../scripts/workflowFixture.mjs'

interface Step {
  name?: string
  id?: string
  if?: string
  env?: Record<string, string>
  with?: Record<string, string>
  run?: string
}

interface Workflow {
  on: Record<string, { inputs: Record<string, { default?: string, type?: string, options?: string[] }> }>
  concurrency?: { group: string }
  jobs: Record<string, {
    name?: string
    needs?: string[]
    with?: Record<string, string>
    outputs?: Record<string, string>
    steps?: Step[]
  }>
}

const graph = readWorkflowGraph('ci-create-weapp-vite.yml')
const entry = graph.get('ci-create-weapp-vite.yml') as Workflow
const shared = graph.get('validate-ci-create-weapp-vite.yml') as Workflow

function step(job: string, name: string) {
  const found = shared.jobs[job]!.steps?.find(candidate => candidate.name === name)
  expect(found, `${job}: ${name}`).toBeDefined()
  return found!
}

describe('scaffold source workflow contract', () => {
  it('defaults to published and forwards the optional source through the reusable boundary', () => {
    expect(entry.on.workflow_dispatch!.inputs.source).toMatchObject({ default: 'published', type: 'choice', options: ['published', 'workspace'] })
    expect(shared.on.workflow_call!.inputs.source).toMatchObject({ default: 'published', type: 'string' })
    expect(entry.jobs.validation!.with?.source).toBe('${{ inputs.source || \'published\' }}')
    expect(entry.concurrency?.group).toContain('${{ inputs.source || \'published\' }}')
    expect(step('prepare', 'Resolve workflow inputs').env?.INPUT_SOURCE).toBe('${{ inputs.source || \'published\' }}')
    expect(shared.jobs.prepare!.outputs?.source).toBe('${{ steps.inputs.outputs.source }}')
  })

  it('retains the six core platform plans and every public template for either source', () => {
    const run = step('prepare', 'Build matrix').run!
    const encoded = run.match(/full_matrix='([^']+)'/)?.[1]
    expect(encoded).toBeDefined()
    const matrix = JSON.parse(encoded!) as { include: { 'os': string, 'node-version': string, 'scope': string, 'templates'?: string }[] }
    expect(matrix.include.filter(row => row.scope === 'core')).toEqual(expect.arrayContaining(
      ['ubuntu-latest', 'windows-latest', 'macos-latest'].flatMap(os => ['22', '24'].map(node => ({ os, 'node-version': node, 'scope': 'core' }))),
    ))
    expect(matrix.include.filter(row => row.scope === 'core')).toHaveLength(6)
    expect(matrix.include.filter(row => row.scope === 'all-templates')).toHaveLength(1)
    expect(matrix.include.find(row => row.scope === 'all-templates')?.templates?.split(',').toSorted()).toEqual(DEFAULT_TEMPLATE_NAMES.toSorted())
    expect(run).not.toContain('INPUT_SOURCE')
  })

  it('builds and packs only workspace mode from the frozen checkout', () => {
    expect(step('smoke', 'Check out code').with?.ref).toBe('${{ needs.pr-context.outputs.checkout_sha }}')
    for (const name of ['Install workspace dependencies', 'Build workspace scaffold', 'Pack frozen workspace scaffold']) {
      expect(step('smoke', name).if).toBe('needs.prepare.outputs.source == \'workspace\'')
    }
    expect(step('smoke', 'Install workspace dependencies').run).toBe('pnpm install --frozen-lockfile')
    expect(step('smoke', 'Build workspace scaffold').run).toBe('pnpm exec turbo run build --filter=create-weapp-vite...')
    expect(step('smoke', 'Pack frozen workspace scaffold')).toMatchObject({
      id: 'workspace',
      env: { CREATE_WEAPP_VITE_SOURCE_COMMIT: '${{ needs.pr-context.outputs.checkout_sha }}' },
      run: 'node scripts/createWeappViteSmoke/workspace.mjs',
    })
  })

  it('passes source evidence to the existing unmodified package-manager scenarios', () => {
    const smoke = step('smoke', 'Run create-weapp-vite smoke matrix')
    expect(smoke.env).toMatchObject({
      CREATE_WEAPP_VITE_SPEC: '${{ needs.prepare.outputs.package_spec }}',
      CREATE_WEAPP_VITE_SOURCE: '${{ needs.prepare.outputs.source }}',
      CREATE_WEAPP_VITE_SOURCE_COMMIT: '${{ needs.pr-context.outputs.checkout_sha }}',
      CREATE_WEAPP_VITE_TARBALL: '${{ steps.workspace.outputs.tarball }}',
      CREATE_WEAPP_VITE_TARBALL_SHA256: '${{ steps.workspace.outputs.tarball_sha256 }}',
      CREATE_WEAPP_VITE_SCENARIOS: '${{ needs.prepare.outputs.scenarios }}',
    })
    expect(smoke.env).not.toHaveProperty('CREATE_WEAPP_VITE_DEPENDENCY_TARBALLS')
    expect(smoke.run).toBe('node ./scripts/create-weapp-vite-smoke.mjs')
  })

  it('isolates job and both artifact identities by source', () => {
    expect(shared.jobs.smoke!.name).toContain('${{ needs.prepare.outputs.source }}')
    expect(step('smoke', 'Upload smoke report artifact').with?.name).toBe('create-weapp-vite-smoke-report-${{ needs.prepare.outputs.source }}-${{ matrix.os }}-node${{ matrix.node-version }}-${{ matrix.scope }}')
    expect(shared.jobs.report!.needs).toContain('prepare')
    expect(step('report', 'Download smoke report artifacts').with?.pattern).toBe('create-weapp-vite-smoke-report-${{ needs.prepare.outputs.source }}-*')
    expect(step('report', 'Upload merged smoke report').with?.name).toBe('create-weapp-vite-smoke-report-summary-${{ needs.prepare.outputs.source }}')
  })
})
