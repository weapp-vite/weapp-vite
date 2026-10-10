import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'
import { it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowStep {
  'id'?: string
  'continue-on-error'?: boolean
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
      'runs-on'?: string
      'env'?: Record<string, unknown>
      'steps'?: WorkflowStep[]
    }
  }
}

function githubExpression(expression: string) {
  return '$' + `{{ ${expression} }}`
}

async function readReleaseWorkflow() {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const content = await fs.readFile(path.join(rootDir, '.github/workflows/release.yml'), 'utf8')
  const workflow = parse(content) as ReleaseWorkflow
  return { content, workflow, job: workflow.jobs?.release, steps: workflow.jobs?.release?.steps ?? [] }
}

it('keeps the repoctl-managed release workflow aligned with the current contract', async () => {
  const { content, workflow, job, steps } = await readReleaseWorkflow()
  const checkoutStep = steps.find(step => step.uses?.startsWith('actions/checkout@'))
  const pnpmSetupStep = steps.find(step => step.uses?.startsWith('pnpm/action-setup@'))

  assert.match(content, /^# repoctl-managed: release\/v2/)
  assert.equal(
    workflow.concurrency?.group,
    `${githubExpression('github.workflow')}-${githubExpression('github.ref')}`,
  )
  assert.equal(workflow.concurrency?.['cancel-in-progress'], false)
  assert.equal(job?.if, undefined)
  assert.equal(job?.['runs-on'], 'ubuntu-latest')
  assert.equal(workflow.env?.npm_config_registry, 'https://registry.npmjs.org')
  assert.equal(workflow.env?.pnpm_config_registry, undefined)
  assert.match(pnpmSetupStep?.uses ?? '', /^pnpm\/action-setup@[\da-f]{40}$/)
  const githubToken = githubExpression('secrets.REPOCTL_RELEASE_TOKEN || secrets.CHANGESETS_RELEASE_TOKEN || github.token')
  assert.equal(job?.env?.GITHUB_TOKEN, undefined)
  assert.equal(workflow.env?.GITHUB_TOKEN, undefined)
  // Git 推送使用 checkout 持久化的凭据，必须与发布 API 使用同一令牌来源。
  assert.equal(checkoutStep?.with?.token, githubToken)
  assert.notEqual(checkoutStep?.with?.['persist-credentials'], false)
  assert.equal(job?.env?.VSCE_PAT, undefined)
  assert.equal(workflow.env?.VSCE_PAT, undefined)
  assert.equal(job?.env?.REPO_RELEASE_MODE, githubExpression('inputs.mode || \'auto\''))
  assert.equal(job?.env?.REPO_RELEASE_PACKAGE, githubExpression('inputs.package'))
  assert.equal(job?.env?.REPO_RELEASE_VERSION, githubExpression('inputs.version'))

  const stages = ['plan', 'verify', 'prepare', 'upload', 'confirm', 'finalize']
  const releaseSteps = steps.filter(step => step.id?.startsWith('release-') && stages.some(stage => step.id === `release-${stage}`))
  assert.deepEqual(releaseSteps.map(step => step.id), stages.map(stage => `release-${stage}`))
  for (const [index, step] of releaseSteps.entries()) {
    assert.equal(step.run, `bash .github/scripts/release-stage.sh ${stages[index]}`)
    assert.deepEqual(step.env, {
      GITHUB_TOKEN: githubToken,
      VSCE_PAT: githubExpression('secrets.VSCE_PAT'),
    }, 'Release credentials must remain scoped to the six release stages')
    assert.equal(step['continue-on-error'], undefined)
    assert.equal(step.if, index === 0
      ? undefined
      : githubExpression(index < 3 ? 'steps.release-plan.outputs.run == \'true\'' : 'steps.release-prepare.outputs.publish == \'true\''))
  }
  for (const step of steps.filter(step => !releaseSteps.includes(step))) {
    assert.equal(step.env?.GITHUB_TOKEN, undefined)
    assert.equal(step.env?.VSCE_PAT, undefined)
  }

  const summaryStep = steps.find(step => step.name === 'Preserve npm publish progress')
  assert.equal(summaryStep?.if, 'always()')
  assert.match(summaryStep?.uses ?? '', /^actions\/upload-artifact@[\da-f]{40}$/)
  assert.deepEqual(String(summaryStep?.with?.path).trim().split(/\r?\n/), [
    'pnpm-publish-summary.json',
    'repoctl-publish-progress.json',
    'repoctl-release-progress.json',
    'repoctl-ci-progress.json',
  ])
  assert.equal(summaryStep?.with?.['if-no-files-found'], 'ignore')
  assert.equal(summaryStep?.with?.['retention-days'], 14)
  assert.equal(summaryStep?.with?.name, `npm-publish-progress-${githubExpression('github.run_id')}-${githubExpression('github.run_attempt')}`)
  assert.ok(steps.indexOf(summaryStep!) > steps.indexOf(releaseSteps.at(-1)!))
  const repoctlConfig = await createJiti(import.meta.url).import<typeof import('../repoctl.config').default>('../repoctl.config.ts', { default: true })
  assert.deepEqual(repoctlConfig.commands.release.qualityScripts, [
    'test:release',
    'check:changeset:frontmatter',
    'check:weapp-core-constants-dependency-range',
    'check:rolldown:single-version',
    'lint',
    'ci:release',
    'test:packages',
    'test:types',
  ])
  assert.equal(repoctlConfig.commands.upgrade.noOverwrite, true)
})

it('shares the original 50-minute release budget across all six stages', async () => {
  const { job, steps } = await readReleaseWorkflow()
  const deadline = steps.find(step => step.name === 'Start shared release deadline')
  const firstStage = steps.find(step => step.id === 'release-plan')
  const restore = steps.find(step => step.id === 'release-cache')
  assert.equal(job?.['timeout-minutes'], 60)
  assert.equal(job?.env?.REPOCTL_RELEASE_BUDGET_SECONDS, 3000)
  assert.match(deadline?.run ?? '', /REPOCTL_RELEASE_DEADLINE_EPOCH=.*date \+%s.*REPOCTL_RELEASE_BUDGET_SECONDS/)
  assert.match(deadline?.run ?? '', />> "\$GITHUB_ENV"/)
  assert.ok(steps.indexOf(restore!) < steps.indexOf(deadline!))
  assert.equal(steps.indexOf(deadline!) + 1, steps.indexOf(firstStage!))
  assert.equal(steps.filter(step => step.run?.includes('REPOCTL_RELEASE_DEADLINE_EPOCH=')).length, 1)
})

it('keeps release caches optional and scoped to a frozen toolchain and lockfile identity', async () => {
  const { job, steps } = await readReleaseWorkflow()
  const identity = steps.find(step => step.name === 'Record release cache toolchain')
  const restore = steps.find(step => step.id === 'release-cache')
  const save = steps.find(step => step.uses?.startsWith('actions/cache/save@'))
  assert.equal(job?.env?.TURBO_CACHE, 'local:rw')
  for (const command of ['node --print process.platform', 'node --print process.arch', 'node --version', 'pnpm --version']) {
    assert.ok(identity?.run?.includes(command))
  }
  const prefix = `release-turbo-v1-${githubExpression('env.REPOCTL_RELEASE_PLATFORM')}-${githubExpression('env.REPOCTL_RELEASE_ARCH')}-node-${githubExpression('env.REPOCTL_RELEASE_NODE_VERSION')}-pnpm-${githubExpression('env.REPOCTL_RELEASE_PNPM_VERSION')}-${githubExpression('hashFiles(\'pnpm-lock.yaml\')')}-`
  assert.match(restore?.uses ?? '', /^actions\/cache\/restore@[\da-f]{40}$/)
  assert.match(save?.uses ?? '', /^actions\/cache\/save@[\da-f]{40}$/)
  assert.equal(String(restore?.with?.['restore-keys']).trim(), prefix)
  assert.equal(restore?.with?.key, `${prefix}${githubExpression('github.sha')}-${githubExpression('github.run_id')}-${githubExpression('github.run_attempt')}`)
  // prepare 会更新锁文件；save 必须沿用 restore 时冻结的身份。
  assert.equal(save?.with?.key, githubExpression('steps.release-cache.outputs.cache-primary-key'))
  for (const step of [restore, save]) {
    assert.equal(step?.['continue-on-error'], true)
    assert.equal(step?.['timeout-minutes'], 2)
    assert.equal(step?.with?.path, '.turbo/cache')
  }
  assert.match(save?.if ?? '', /success\(\)/)
  assert.match(save?.if ?? '', /steps\.release-plan\.outputs\.run == 'true'/)
  assert.match(save?.if ?? '', /steps\.release-cache\.outputs\.cache-primary-key != ''/)
  assert.match(save?.if ?? '', /contains\(fromJSON\('\["refs\/heads\/main", "refs\/heads\/alpha", "refs\/heads\/beta", "refs\/heads\/rc", "refs\/heads\/next"\]'\), github\.ref\)/)
  assert.match(save?.if ?? '', /github\.event_name == 'push' \|\| github\.event_name == 'workflow_dispatch'/)
  assert.ok(steps.indexOf(identity!) < steps.indexOf(restore!))
  assert.ok(steps.indexOf(save!) > steps.findIndex(step => step.id === 'release-finalize'))
})

it('keeps the agent CLI on the stable release line', async () => {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const packageJson = JSON.parse(
    await fs.readFile(path.join(rootDir, 'packages/agent-cli/package.json'), 'utf8'),
  ) as { private?: boolean, version?: string }

  assert.equal(packageJson.private, false)
  assert.match(packageJson.version ?? '', /^\d+\.\d+\.\d+$/)
})

it.each(['policy-pr', 'policy-full'])('runs release guards in %s before publishing', async (jobName) => {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const content = await fs.readFile(path.join(rootDir, '.github/workflows/ci-policy.yml'), 'utf8')
  const workflow = parse(content) as { jobs?: Record<string, { with?: { main_command?: string } }> }
  const commands = workflow.jobs?.[jobName]?.with?.main_command ?? ''
  assert.match(commands, /^\s*pnpm test:release\s*$/m)
})
