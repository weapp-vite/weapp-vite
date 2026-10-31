import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createJiti } from 'jiti'
import { describe, expect, it } from 'vitest'
import { readWorkflowFixture } from './workflowFixture.mjs'

interface Step {
  id?: string
  name?: string
  if?: string
  uses?: string
  run?: string
  env?: Record<string, unknown>
  with?: Record<string, unknown>
}

interface Job {
  'concurrency'?: Record<string, unknown>
  'if'?: string
  'needs'?: string
  'uses'?: string
  'permissions'?: Record<string, string>
  'outputs'?: Record<string, string>
  'with'?: Record<string, string>
  'env'?: Record<string, string>
  'steps'?: Step[]
  'timeout-minutes'?: number
}

interface Workflow {
  concurrency?: Record<string, unknown>
  on: {
    schedule: { cron: string }[]
    workflow_dispatch: { inputs: Record<string, { options?: string[] }> }
    pull_request?: unknown
    pull_request_target?: unknown
    workflow_run?: unknown
  }
  jobs: Record<string, Job>
}

const workflow = readWorkflowFixture('release.yml') as Workflow

function expression(value: string) {
  return `$` + `{{ ${value} }}`
}

function runNightlyInputRejection(name: string, parentEnv = process.env) {
  const publish = workflow.jobs.nightly!.steps!.find(step => step.id === 'nightly-publish')!
  // 与 Actions 一样禁用启动文件，并仅传递测试所需环境，隔离 BASH_ENV 等父环境注入。
  return spawnSync('bash', ['--noprofile', '--norc', '-eu', '-c', `PATH=''\n${publish.run!}`], {
    encoding: 'utf8',
    env: {
      PATH: parentEnv.PATH,
      RUNNER_TEMP: '',
      REPO_RELEASE_PACKAGE: '',
      REPO_RELEASE_VERSION: '',
      REPO_RELEASE_RECOVERY_SOURCE_SHA: '',
      [name]: 'unexpected-selection',
    },
  })
}

describe('repoctl nightly workflow', () => {
  it('serializes npm publishers without holding their lock during documentation deployment', () => {
    expect(workflow.concurrency).toBeUndefined()
    const publishers = { 'group': `npm-release-${expression('github.ref')}`, 'cancel-in-progress': false }
    expect(workflow.jobs.release?.concurrency).toEqual(publishers)
    expect(workflow.jobs.nightly?.concurrency).toEqual(publishers)
    expect(workflow.jobs.docs?.concurrency).toBeUndefined()
    expect(workflow.jobs['oidc-audit']?.concurrency).toBeUndefined()
    const docs = readWorkflowFixture('repoctl-docs-deploy.yml') as { concurrency: Record<string, unknown> }
    expect(docs.concurrency).toEqual({
      'group': `docs-${expression('inputs.site')}-${expression('inputs.channel')}`,
      'cancel-in-progress': false,
    })
  })

  it('uses one existing publisher workflow with matching manual and scheduled routes', async () => {
    const config = await createJiti(import.meta.url).import<{
      commands: { release: { nightly: { provider: string, schedule: string } } }
    }>('../repoctl.config.ts', { default: true })
    const nightly = config.commands.release.nightly
    expect(nightly).toEqual({ provider: 'npm', schedule: '17 22 * * *' })
    expect(workflow.on.schedule).toEqual([{ cron: nightly.schedule }])
    expect(workflow.on.workflow_dispatch.inputs.mode?.options).toEqual([
      'auto',
      'prepare',
      'publish',
      'publish-unpublished',
      'reconcile',
      'oidc-audit',
      'nightly',
    ])
    expect(workflow.jobs.nightly?.if).toBe(expression(`(github.event_name == 'schedule' && github.event.schedule == '${nightly.schedule}') || (github.event_name == 'workflow_dispatch' && inputs.mode == 'nightly')`))
    expect(workflow.jobs.nightly?.env).toEqual({
      REPOCTL_NIGHTLY_PROVIDER: nightly.provider,
      REPOCTL_NIGHTLY_SCHEDULE: nightly.schedule,
    })
    expect(workflow.on.pull_request).toBeUndefined()
    expect(workflow.on.pull_request_target).toBeUndefined()
    expect(workflow.on.workflow_run).toBeUndefined()
  })

  it.each(['nightly', 'oidc-audit'])('restricts %s to the default branch and read-only repository access', (jobName) => {
    const job = workflow.jobs[jobName]!
    expect(job.permissions).toEqual({ 'contents': 'read', 'id-token': 'write' })
    const steps = job.steps!
    const guard = steps[0]!
    const checkout = steps.find(step => step.uses?.startsWith('actions/checkout@'))!
    expect(guard.env?.DEFAULT_BRANCH).toBe(expression('github.event.repository.default_branch'))
    expect(guard.run).toContain('"$GITHUB_REF" != "refs/heads/$DEFAULT_BRANCH"')
    expect(guard.run).toContain('exit 1')
    expect(checkout.with?.['persist-credentials']).toBe(false)
    expect(steps.some(step => step.run === 'pnpm install --frozen-lockfile --ignore-scripts')).toBe(true)
    for (const step of steps) {
      expect(step.env?.GITHUB_TOKEN).toBeUndefined()
      expect(step.env?.VSCE_PAT).toBeUndefined()
      expect(step.env?.NODE_AUTH_TOKEN).toBeUndefined()
    }
  })

  it('delegates audit, uncached quality, packing, publication and consumer checks to the native pipeline', () => {
    const nightly = workflow.jobs.nightly!
    const steps = nightly.steps!
    const publish = steps.find(step => step.id === 'nightly-publish')!
    expect(nightly['timeout-minutes']).toBe(240)
    expect(steps.find(step => step.id === 'nightly-checkout')?.with?.ref).toBe(expression('github.sha'))
    expect(steps.find(step => step.id === 'nightly-npm')?.run).toBe('npm install --global npm@11.16.0 --registry=https://registry.npmjs.org')
    expect(publish.env?.REPOCTL_SNAPSHOT_PUBLISH).toBe('1')
    expect(publish.run).toContain('args=(--publish --output "$RUNNER_TEMP/repoctl-nightly" --json)')
    expect(publish.run).toContain('args+=(--dry-run)')
    expect(publish.run).toContain('export REPOCTL_NIGHTLY_QUALITY_DEADLINE_EPOCH="$(( $(date +%s) + 2700 ))"')
    expect(publish.run).toContain('pnpm exec repo release nightly "$' + '{args[@]}"')
    expect(publish.run).not.toMatch(/npm publish|--filter|--tag latest|version -r/)
    expect(steps.some(step => step.uses?.startsWith('actions/cache/'))).toBe(false)
    const diagnostics = steps.find(step => step.name === 'Preserve nightly diagnostics')!
    expect(diagnostics.if).toBe(expression('always()'))
    expect(diagnostics.with?.['retention-days']).toBe(14)
  })

  it('archives native reports and tarballs without recursively scanning isolated dependency trees', () => {
    const diagnostics = workflow.jobs.nightly!.steps!.find(step => step.name === 'Preserve nightly diagnostics')!
    const patterns = String(diagnostics.with?.path).trim().split('\n').map(pattern => pattern.replace(`${expression('runner.temp')}/`, ''))
    expect(patterns.every(pattern => !pattern.includes('**'))).toBe(true)
    const nightly = 'repoctl-nightly/repoctl-nightly-run'
    const snapshot = `${nightly}/repoctl-snapshot-identity-run`
    const reports = [
      'repoctl-nightly/report.json',
      `${nightly}/nightly-report.json`,
      `${nightly}/consumer-report.json`,
      `${snapshot}/snapshot-report.json`,
      `${snapshot}/tarballs/0/package.tgz`,
      `${snapshot}/tarballs/41/package.tgz`,
    ]
    const dependencies = [
      `${snapshot}/source/node_modules/package/nightly-report.json`,
      `${snapshot}/source/node_modules/package/tarballs/0/package.tgz`,
      `${snapshot}/consumers/0/node_modules/package/snapshot-report.json`,
      `${nightly}/consumer/node_modules/package/consumer-report.json`,
    ]
    expect([...reports, ...dependencies].filter(file => patterns.some(pattern => path.matchesGlob(file, pattern)))).toEqual(reports)
  })

  it('audits every public package and passes recovery inputs to their validation boundary', () => {
    const audit = workflow.jobs['oidc-audit']!.steps!.find(step => step.name === 'Audit every publishable package')!
    expect(audit.run).toBe('pnpm exec repo release ci --mode oidc-audit')
    for (const jobName of ['nightly', 'oidc-audit']) {
      const command = workflow.jobs[jobName]!.steps!.find(step => step.run?.includes('pnpm exec repo release'))!
      expect(command.env).toMatchObject({
        REPO_RELEASE_PACKAGE: expression('inputs.package'),
        REPO_RELEASE_VERSION: expression('inputs.version'),
        REPO_RELEASE_DRY_RUN: expression('inputs.dry-run'),
        REPO_RELEASE_RECOVERY_SOURCE_SHA: expression('inputs.source-sha'),
      })
    }
  })

  it.runIf(process.platform !== 'win32').each([
    'REPO_RELEASE_PACKAGE',
    'REPO_RELEASE_VERSION',
    'REPO_RELEASE_RECOVERY_SOURCE_SHA',
  ])('rejects nightly input %s before invoking the publisher', (name) => {
    const result = runNightlyInputRejection(name)
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('recovery inputs are not supported')
    expect(result.stderr).toBe('')
  })

  it.runIf(process.platform !== 'win32')('ignores parent Bash startup files before rejecting nightly recovery input', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'nightly-bash-startup-'))
    try {
      const startup = path.join(directory, 'startup.bash')
      writeFileSync(startup, 'printf \'unexpected Bash startup\\n\' >&2\nexit 97\n')
      const parentEnv = { PATH: process.env.PATH, BASH_ENV: startup, ENV: startup }
      // 先证明启动文件会被 Bash 执行；--norc 本身不会屏蔽 BASH_ENV。
      const control = spawnSync('bash', ['--noprofile', '--norc', '-eu', '-c', 'exit 0'], {
        encoding: 'utf8',
        env: parentEnv,
      })
      expect(control.status).toBe(97)
      expect(control.stderr).toContain('unexpected Bash startup')

      const result = runNightlyInputRejection('REPO_RELEASE_PACKAGE', parentEnv)
      expect(result.status).toBe(1)
      expect(result.stdout).toContain('recovery inputs are not supported')
      expect(result.stderr).toBe('')
    }
    finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})

it('deploys stable docs only after a genuine main release completion record', () => {
  const release = workflow.jobs.release!
  const docs = workflow.jobs.docs!
  expect(release.outputs).toEqual({
    'release-record': expression('steps.release-finalize.outputs.release-record'),
    'docs-sites': expression('steps.release-finalize.outputs.docs-sites'),
  })
  expect(docs.needs).toBe('release')
  expect(docs.if).toContain('github.ref == \'refs/heads/main\'')
  expect(docs.if).toContain('needs.release.outputs.release-record != \'\'')
  expect(docs.if).toContain('needs.release.outputs.docs-sites != \'[]\'')
  expect(docs.uses).toBe('./.github/workflows/repoctl-docs-deploy.yml')
  expect(docs.with).toEqual({
    site: expression('matrix.site'),
    channel: 'stable',
    release: expression('needs.release.outputs.release-record'),
  })
})
