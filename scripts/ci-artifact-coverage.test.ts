import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { glob } from 'tinyglobby'
import { describe, expect, it } from 'vitest'
import { readVerificationTopologyVariant, readWorkflowFixture, readWorkflowGraph } from './workflowFixture.mjs'

interface WorkflowStep {
  name?: string
  uses?: string
  if?: string
  run?: string
  with?: Record<string, unknown>
  env?: Record<string, unknown>
}

interface Workflow {
  on?: { workflow_call?: { inputs?: Record<string, unknown> } }
  jobs: Record<string, { steps?: WorkflowStep[], with?: Record<string, unknown>, env?: Record<string, unknown> }>
}

async function readWorkflow(name: string) {
  return readWorkflowFixture(name) as Workflow
}

function splitPatterns(value: unknown) {
  expect(typeof value).toBe('string')
  return String(value).trim().split(/\r?\n/).map(pattern => pattern.trim()).filter(Boolean)
}

describe('CI artifact coverage', () => {
  it('prepares imported fixture support files after restoring package artifacts and before internal tests', async () => {
    const workflow = await readWorkflow(readVerificationTopologyVariant() === 'baseline' ? 'validate-ci-e2e.yml' : 'reusable-miniapp-platform.yml')
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
    const workflow = await readWorkflow(readVerificationTopologyVariant() === 'baseline' ? 'validate-ci-e2e.yml' : 'reusable-miniapp-platform.yml')
    const job = workflow.jobs['ide-dom-acceptance-internal']
    const commands = splitPatterns(job.with?.main_command)
    const inventoryIndex = commands.indexOf('node --import tsx e2e/scripts/domAcceptanceReport/inventory.ts --write --check')
    expect(inventoryIndex).toBeGreaterThanOrEqual(0)
    expect(inventoryIndex).toBeLessThan(commands.findIndex(command => command.includes('vitest.e2e.internal.config.ts')))
    expect(job.with?.artifact_name).toContain('needs.pr-context.outputs.checkout_sha')
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
      '.cache/e2e-native/windows-kernel-inspector/snapshot.exe',
      '.cache/e2e-native/windows-kernel-inspector/manifest.json',
      '.tmp/build-artifact-manifest.json',
      '.tmp/verification-telemetry/plans/**',
    ])
  })

  it('builds Windows E2E tools explicitly before publishing and only verifies restored tools', async () => {
    const workflow = await readWorkflow('reusable-node-command.yml')
    expect(workflow.on?.workflow_call?.inputs?.e2e_native_tools).toEqual({ required: false, type: 'boolean', default: false })
    const job = workflow.jobs.run
    const steps = job.steps ?? []
    const buildIndex = steps.findIndex(step => step.name === 'Build private Windows E2E native tools')
    const verifyIndex = steps.findIndex(step => step.name === 'Verify private Windows E2E native tools without compilation')
    expect(buildIndex).toBeGreaterThan(steps.findIndex(step => step.uses === './.github/actions/refresh-workspace-deps'))
    expect(buildIndex).toBeLessThan(steps.findIndex(step => step.name === 'Create workspace build artifact manifest'))
    expect(steps[buildIndex]).toMatchObject({ if: 'runner.os == \'Windows\' && inputs.e2e_native_tools && inputs.consume_build_artifact == \'\'', run: 'pnpm e2e:build-tools' })
    expect(verifyIndex).toBeGreaterThan(steps.findIndex(step => step.name === 'Verify restored workspace artifact identity'))
    expect(verifyIndex).toBeLessThan(steps.findIndex(step => step.name === 'Run command'))
    expect(steps[verifyIndex]).toMatchObject({ if: 'runner.os == \'Windows\' && inputs.e2e_native_tools && inputs.consume_build_artifact != \'\'', run: 'pnpm e2e:build-tools -- --check' })
    expect(Object.values(job.env ?? {}).join('\n')).not.toMatch(/\brunner\./u)
    expect(job.env?.BUILD_ARTIFACT_EXPECTED_E2E_NATIVE_TOOLS).toBeUndefined()
    const requirementIndex = steps.findIndex(step => step.name === 'Configure private Windows E2E artifact requirement')
    expect(requirementIndex).toBeGreaterThanOrEqual(0)
    for (const name of ['Download workspace build artifact', 'Refresh workspace links after artifact restore', 'Verify restored workspace artifact identity', 'Create workspace build artifact manifest']) {
      expect(requirementIndex).toBeLessThan(steps.findIndex(step => step.name === name))
    }
    // eslint-disable-next-line no-template-curly-in-string -- GitHub Actions 表达式只能在支持 runner 上下文的步骤环境中求值。
    expect(steps[requirementIndex]?.env?.BUILD_ARTIFACT_EXPECTED_E2E_NATIVE_TOOLS).toBe('${{ inputs.e2e_native_tools && runner.os == \'Windows\' && \'1\' || \'\' }}')
    expect(steps[requirementIndex]).toMatchObject({
      shell: 'bash',
      run: 'echo "BUILD_ARTIFACT_EXPECTED_E2E_NATIVE_TOOLS=$BUILD_ARTIFACT_EXPECTED_E2E_NATIVE_TOOLS" >> "$GITHUB_ENV"',
    })
  })

  it('shares the native tool producer across Miniapp consumers and keeps unrelated browser tests opt out', async () => {
    const workflow = await readWorkflow('reusable-miniapp-platform.yml')
    for (const jobName of ['build', 'ide-dom-headless', 'ide-dom-acceptance-internal', 'miniapp', 'hmr', 'bun-cli']) {
      expect(workflow.jobs[jobName].with?.e2e_native_tools, jobName).toBe(true)
    }
    expect(workflow.jobs['simulator-browser'].with?.e2e_native_tools).toBeUndefined()
  })

  it('shares native tools with the root coverage infrastructure without making static contracts depend on them', async () => {
    const workflow = await readWorkflow('reusable-quality-platform.yml')
    for (const jobName of ['build', 'coverage']) {
      expect(workflow.jobs[jobName].with?.e2e_native_tools, jobName).toBe(true)
    }
    for (const jobName of ['contracts', 'types', 'lint']) {
      expect(workflow.jobs[jobName].with?.e2e_native_tools, jobName).toBeUndefined()
    }
  })

  it('prepares native tools for direct Windows E2E diagnostics as well as restored Bun consumers', async () => {
    const workflow = await readWorkflow('validate-ci-e2e.yml')
    for (const jobName of ['watcher-comparison-diagnostic', 'windows-dev-cleanup-diagnostic', 'windows-native-runtime-cleanup-diagnostic', 'windows-startup-fallback-diagnostic', 'runtime-publication-diagnostic', 'lifecycle-diagnostic', 'shared-layout-windows-diagnostic', 'shared-compiler-hosts', 'bun-build-diagnostic', 'bun-cli']) {
      expect(workflow.jobs[jobName].with?.e2e_native_tools, jobName).toBe(true)
    }
    for (const jobName of ['native-compiler-batch-diagnostic', 'plugin-watch-readiness-diagnostic', 'windows-process-narrow-diagnostic']) {
      expect(workflow.jobs[jobName].with?.e2e_native_tools, jobName).toBeUndefined()
    }
  })

  it('prepares native tools for the standalone Windows process identity probe', async () => {
    const workflow = await readWorkflow('windows-process-identity-probe.yml')
    for (const jobName of ['writer-full-build', 'writer-full-dom', 'provider-cleanup', 'process-row-contract']) {
      expect(workflow.jobs[jobName].with?.e2e_native_tools, jobName).toBe(true)
    }
    const steps = workflow.jobs['self-writer-check'].steps ?? []
    const buildIndex = steps.findIndex(step => step.name === 'Build private Windows E2E native tools')
    expect(steps[buildIndex]?.run).toBe('pnpm e2e:build-tools')
    expect(buildIndex).toBeGreaterThan(steps.findIndex(step => step.name === 'Prepare E2E bridge dependencies'))
    expect(buildIndex).toBeLessThan(steps.findIndex(step => step.name === 'Verify isolated E2E journal and bridge contracts'))
    expect(buildIndex).toBeLessThan(steps.findIndex(step => step.name === 'Diagnose stateful cleanup with the existing DOM manifest'))
  })

  it.each(['web-e2e-baseline-pr', 'web-e2e-baseline-full'])('retains Web failure diagnostics alongside the existing visual artifacts in %s', async (jobName) => {
    const workflow = await readWorkflow('ci-e2e.yml')
    expect(splitPatterns(workflow.jobs[jobName].with?.artifact_path)).toEqual([
      '.tmp/web-runtime-visual/**',
      '.tmp/web-runtime-diagnostics/**',
      '.tmp/uview-plus-compat/web/**',
      '.tmp/wot-ui-compat/web/**',
    ])
  })

  it('selects hidden reports without uploading unrelated temporary files', async () => {
    const reusable = await readWorkflow('reusable-node-command.yml')
    const steps = Object.values(reusable.jobs).flatMap(job => job.steps ?? [])
    const upload = steps.find(step => step.name === 'Upload artifact')
    const workflows = readWorkflowGraph('ci-e2e.yml') as Map<string, Workflow>
    const reportPatterns = [...workflows.values()].flatMap(workflow => Object.values(workflow.jobs)).filter(job => job.with?.artifact_path).flatMap(job => splitPatterns(job.with?.artifact_path))
    const reports = [
      '.tmp/hmr-lifecycle-report.json',
      '.tmp/shared-hosts/artifacts.json',
      '.tmp/workspace-hmr/.session/report.json',
      '.tmp/web-runtime-diagnostics/issue-1029-sample/viewport.png',
      '.tmp/web-runtime-diagnostics/issue-1029-sample/failure.json',
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
