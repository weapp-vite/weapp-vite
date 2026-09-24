import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'
import { it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowStep {
  name?: string
  if?: string
  uses?: string
  env?: Record<string, unknown>
  with?: Record<string, unknown>
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
  assert.equal(summaryStep?.with?.path, 'pnpm-publish-summary.json')
  assert.equal(summaryStep?.with?.['if-no-files-found'], 'ignore')
  assert.ok(steps.indexOf(summaryStep!) > steps.indexOf(releaseStep!))
  const repoctlConfig = await createJiti(import.meta.url).import<typeof import('../repoctl.config').default>('../repoctl.config.ts', { default: true })
  assert.ok(repoctlConfig.commands.release.qualityScripts.includes('test:release'))
})
