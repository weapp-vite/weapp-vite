import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'
import { it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowStep {
  'timeout-minutes'?: number
  'name'?: string
  'if'?: string
  'uses'?: string
  'env'?: Record<string, unknown>
  'with'?: Record<string, unknown>
  'run'?: string
}

interface ReleaseWorkflow {
  concurrency?: Record<string, unknown>
  env?: Record<string, unknown>
  jobs?: {
    release?: {
      'timeout-minutes'?: number
      'if'?: string
      'steps'?: WorkflowStep[]
    }
  }
}

function githubExpression(expression: string) {
  return '$' + `{{ ${expression} }}`
}

function assertReleaseTimeoutBudget(jobMinutes: unknown, stepMinutes: unknown) {
  assert.ok(typeof jobMinutes === 'number' && Number.isFinite(jobMinutes) && jobMinutes >= 60, 'Release job must allow at least 60 minutes')
  assert.ok(typeof stepMinutes === 'number' && Number.isFinite(stepMinutes) && stepMinutes >= 50, 'Release command must explicitly allow at least 50 minutes')
  assert.ok(jobMinutes - stepMinutes >= 10, 'Release job must reserve at least 10 minutes outside the release command')
}

it('keeps the repoctl-managed release workflow aligned with the current contract', async () => {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const workflowPath = path.join(rootDir, '.github/workflows/release.yml')
  const content = await fs.readFile(workflowPath, 'utf8')
  const workflow = parse(content) as ReleaseWorkflow
  const releaseJob = workflow.jobs?.release
  const steps = releaseJob?.steps ?? []
  const pnpmSetupStep = steps.find(step => step.uses?.startsWith('pnpm/action-setup@'))
  // The generated workflow keeps release arguments in a multiline shell
  // block, so identify the step by its stable name/command rather than an
  // exact scalar match.
  const releaseStep = steps.find(step => step.name === 'Run repo release CI' || step.run?.includes('pnpm exec repo release ci'))

  assert.match(content, /^# repoctl-managed: release\/v2/)
  assert.equal(
    workflow.concurrency?.group,
    `${githubExpression('github.workflow')}-${githubExpression('github.ref')}`,
  )
  assert.equal(workflow.concurrency?.['cancel-in-progress'], false)
  assert.equal(releaseJob?.if, undefined)
  assertReleaseTimeoutBudget(releaseJob?.['timeout-minutes'], releaseStep?.['timeout-minutes'])
  assert.equal(workflow.env?.npm_config_registry, 'https://registry.npmjs.org')
  assert.equal(workflow.env?.pnpm_config_registry, undefined)
  assert.match(pnpmSetupStep?.uses ?? '', /^pnpm\/action-setup@[\da-f]{40}$/)
  assert.equal(
    releaseStep?.env?.GITHUB_TOKEN,
    githubExpression('secrets.REPOCTL_RELEASE_TOKEN || secrets.CHANGESETS_RELEASE_TOKEN || github.token'),
  )
  assert.equal(releaseStep?.env?.VSCE_PAT, githubExpression('secrets.VSCE_PAT'))

  const summaryStep = steps.find(step => step.name === 'Preserve npm publish summary')
  assert.equal(summaryStep?.if, 'always()')
  assert.match(summaryStep?.uses ?? '', /^actions\/upload-artifact@[\da-f]{40}$/)
  assert.deepEqual(String(summaryStep?.with?.path).trim().split(/\r?\n/), [
    'pnpm-publish-summary.json',
    'repoctl-publish-progress.json',
  ])
  assert.equal(summaryStep?.with?.['if-no-files-found'], 'ignore')
  assert.ok(steps.indexOf(summaryStep!) > steps.indexOf(releaseStep!))
  const repoctlConfig = await createJiti(import.meta.url).import<typeof import('../repoctl.config').default>('../repoctl.config.ts', { default: true })
  assert.ok(repoctlConfig.commands.release.qualityScripts.includes('test:release'))
  assert.equal(repoctlConfig.commands.upgrade.noOverwrite, true)
})

it.each([
  { scenario: 'the original 30-minute job', jobMinutes: 30, stepMinutes: 50, error: /job must allow at least 60 minutes/ },
  { scenario: 'a missing command timeout', jobMinutes: 60, stepMinutes: undefined, error: /command must explicitly allow at least 50 minutes/ },
  { scenario: 'insufficient archive headroom', jobMinutes: 60, stepMinutes: 55, error: /reserve at least 10 minutes/ },
])('rejects $scenario', ({ jobMinutes, stepMinutes, error }) => {
  assert.throws(() => assertReleaseTimeoutBudget(jobMinutes, stepMinutes), error)
})

it.each(['policy-pr', 'policy-full'])('runs release guards in %s before publishing', async (jobName) => {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const content = await fs.readFile(path.join(rootDir, '.github/workflows/ci-policy.yml'), 'utf8')
  const workflow = parse(content) as { jobs?: Record<string, { with?: { main_command?: string } }> }
  const commands = workflow.jobs?.[jobName]?.with?.main_command ?? ''
  assert.match(commands, /^\s*pnpm test:release\s*$/m)
})
