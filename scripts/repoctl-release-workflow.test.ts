import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowStep {
  name?: string
  uses?: string
  env?: Record<string, unknown>
  run?: string
}

interface ReleaseWorkflow {
  concurrency?: Record<string, unknown>
  env?: Record<string, unknown>
  jobs?: {
    release?: {
      if?: string
      steps?: WorkflowStep[]
    }
  }
}

function githubExpression(expression: string) {
  return '$' + `{{ ${expression} }}`
}

it('keeps the repoctl-managed release workflow aligned with the current contract', async () => {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const workflowPath = path.join(rootDir, '.github/workflows/release.yml')
  const content = await fs.readFile(workflowPath, 'utf8')
  const workflow = parse(content) as ReleaseWorkflow
  const releaseJob = workflow.jobs?.release
  const steps = releaseJob?.steps ?? []
  const pnpmSetupStep = steps.find(step => step.uses?.startsWith('pnpm/action-setup@'))
  const releaseStep = steps.find(step => step.run === 'pnpm exec repo release ci')

  assert.match(content, /^# repoctl-managed: release\/v2/)
  assert.equal(
    workflow.concurrency?.group,
    `${githubExpression('github.workflow')}-${githubExpression('github.ref')}`,
  )
  assert.equal(workflow.concurrency?.['cancel-in-progress'], false)
  assert.equal(releaseJob?.if, undefined)
  assert.equal(workflow.env?.npm_config_registry, 'https://registry.npmjs.org')
  assert.equal(workflow.env?.pnpm_config_registry, undefined)
  assert.match(pnpmSetupStep?.uses ?? '', /^pnpm\/action-setup@[\da-f]{40}$/)
  assert.equal(
    releaseStep?.env?.GITHUB_TOKEN,
    githubExpression('secrets.REPOCTL_RELEASE_TOKEN || secrets.CHANGESETS_RELEASE_TOKEN || github.token'),
  )
  assert.equal(releaseStep?.env?.VSCE_PAT, githubExpression('secrets.VSCE_PAT'))
})
