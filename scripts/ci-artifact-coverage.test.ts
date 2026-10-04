import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { glob } from 'tinyglobby'
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
  it('prepares imported fixture support files after restoring package artifacts and before internal tests', async () => {
    const workflow = await readWorkflow('ci-e2e.yml')
    const job = workflow.jobs['ide-dom-acceptance-internal']
    expect(job.with?.consume_build_artifact).toBeTruthy()
    const commands = splitPatterns(job.with?.main_command)
    const testIndex = commands.findIndex(command => command.includes('vitest.e2e.internal.config.ts'))
    expect(testIndex).toBeGreaterThanOrEqual(0)
    for (const fixture of ['github-issues', 'template-wevu-regression']) {
      const prepareIndex = commands.indexOf(`node packages/weapp-vite/bin/weapp-vite.js prepare e2e-apps/${fixture} --platform weapp`)
      expect(prepareIndex).toBeGreaterThanOrEqual(0)
      expect(prepareIndex).toBeLessThan(testIndex)
    }
  })

  it('generates and checks the current source inventory before tests and uploads both reports', async () => {
    const workflow = await readWorkflow('ci-e2e.yml')
    const job = workflow.jobs['ide-dom-acceptance-internal']
    const commands = splitPatterns(job.with?.main_command)
    const inventoryIndex = commands.indexOf('node --import tsx e2e/scripts/domAcceptanceReport/inventory.ts --write --check')
    expect(inventoryIndex).toBeGreaterThanOrEqual(0)
    expect(inventoryIndex).toBeLessThan(commands.findIndex(command => command.includes('vitest.e2e.internal.config.ts')))
    expect(job.with?.artifact_name).toContain('github.sha')
    expect(splitPatterns(job.with?.artifact_path)).toEqual([
      'e2e/dom-acceptance-inventory.json',
      'e2e/dom-acceptance-inventory.md',
    ])
  })

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

  it('selects hidden reports without uploading unrelated temporary files', async () => {
    const reusable = await readWorkflow('reusable-node-command.yml')
    const steps = Object.values(reusable.jobs).flatMap(job => job.steps ?? [])
    const upload = steps.find(step => step.name === 'Upload artifact')
    const workflow = await readWorkflow('ci-e2e.yml')
    const reportPatterns = Object.values(workflow.jobs)
      .filter(job => job.with?.artifact_path)
      .flatMap(job => splitPatterns(job.with?.artifact_path))
    const reports = [
      '.tmp/hmr-lifecycle-report.json',
      '.tmp/shared-hosts/artifacts.json',
      '.tmp/workspace-hmr/.session/report.json',
      'docs/reports/dom-acceptance/summary.json',
    ]
    const unrelated = [
      '.env',
      '.tmp/.env',
      '.tmp/unrelated/report.json',
      '.tmp/shared-hosts/secrets.json',
      'src/index.ts',
      'node_modules/example/index.js',
    ]
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'ci-artifact-coverage-'))
    try {
      for (const file of [...reports, ...unrelated]) {
        const target = path.join(fixtureRoot, file)
        await mkdir(path.dirname(target), { recursive: true })
        await writeFile(target, '')
      }
      const selected = await glob(reportPatterns, {
        cwd: fixtureRoot,
        dot: upload?.with?.['include-hidden-files'] === true,
      })
      expect(selected.sort()).toEqual(reports.sort())
    }
    finally {
      await rm(fixtureRoot, { recursive: true, force: true })
    }
  })
})
