import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const root = path.resolve(import.meta.dirname, '..')

interface WorkflowStep {
  name?: string
  uses?: string
  with?: Record<string, unknown>
}

interface Workflow {
  jobs: Record<string, { steps?: WorkflowStep[], with?: Record<string, unknown> }>
}

async function readWorkflow(name: string) {
  return parse(await readFile(path.join(root, '.github/workflows', name), 'utf8')) as Workflow
}

function splitPatterns(value: unknown) {
  expect(typeof value).toBe('string')
  return String(value).trim().split(/\r?\n/).map(pattern => pattern.trim()).filter(Boolean)
}

describe('CI artifact coverage', () => {
  it('uploads the build identity manifest while restricting hidden files to build output paths', async () => {
    const workflow = await readWorkflow('reusable-node-command.yml')
    const steps = Object.values(workflow.jobs).flatMap(job => job.steps ?? [])
    const upload = steps.find(step => step.name === 'Upload workspace build artifact')
    expect(upload?.with?.['include-hidden-files']).toBe(true)
    expect(upload?.with?.['if-no-files-found']).toBe('error')
    expect(splitPatterns(upload?.with?.path)).toEqual([
      'packages/*/dist/**',
      'packages-runtime/*/dist/**',
      'packages-private/*/dist/**',
      '@weapp-core/*/dist/**',
      'benchmarks/*/dist/**',
      'mpcore/packages/*/dist/**',
      'packages/*/bin/**',
      'packages-runtime/*/bin/**',
      'packages-private/*/bin/**',
      '@weapp-core/*/bin/**',
      'mpcore/packages/*/bin/**',
      '.tmp/build-artifact-manifest.json',
    ])
  })

  it('includes hidden report directories without uploading unrelated temporary files', async () => {
    const reusable = await readWorkflow('reusable-node-command.yml')
    const steps = Object.values(reusable.jobs).flatMap(job => job.steps ?? [])
    const upload = steps.find(step => step.name === 'Upload artifact')
    expect(upload?.with?.['include-hidden-files']).toBe(true)
    expect(upload?.with?.path).toBe('$' + '{{ inputs.artifact_path }}')
    const workflow = await readWorkflow('ci-e2e.yml')
    const reportPatterns = Object.values(workflow.jobs)
      .filter(job => job.with?.artifact_path)
      .flatMap(job => splitPatterns(job.with?.artifact_path))
    expect([...new Set(reportPatterns)].sort()).toEqual([
      '.tmp/uview-plus-compat/web/**',
      '.tmp/web-runtime-visual/**',
      '.tmp/workspace-hmr/**',
      '.tmp/wot-ui-compat/web/**',
      'docs/reports/*-e2e-ci-full-*-suite-report/**',
      'docs/reports/*-e2e-ci-pr-*-suite-report/**',
      'docs/reports/*-e2e-ide-dom-headless-*-suite-report/**',
      'docs/reports/dom-acceptance/**',
      'docs/reports/simulator-browser/**',
    ])
  })
})
