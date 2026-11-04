import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'vitest'
import { readWorkflowFixture } from './workflowFixture.mjs'

interface Step {
  'id'?: string
  'name'?: string
  'if'?: string
  'uses'?: string
  'run'?: string
  'working-directory'?: string
  'env'?: Record<string, unknown>
  'with'?: Record<string, unknown>
}

interface Concurrency {
  'group': string
  'cancel-in-progress': boolean
}

interface Job {
  concurrency?: string | Concurrency
  if?: string
  needs?: string | string[]
  permissions?: Record<string, string>
  env?: Record<string, unknown>
  steps?: Step[]
}

interface Workflow {
  concurrency?: string | Concurrency
  on: {
    workflow_dispatch: {
      inputs: Record<string, { type?: string, required?: boolean, default?: unknown, options?: string[] }>
    }
  }
  jobs: Record<string, Job>
}

interface PackageManifest {
  version?: string
  devDependencies?: Record<string, string>
  scripts?: Record<string, string>
}

const workflow = readWorkflowFixture('release.yml') as Workflow
const rootPackage = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as PackageManifest

function expression(value: string) {
  return '$' + `{{ ${value} }}`
}

function job(name: string) {
  const selected = workflow.jobs[name]
  assert.ok(selected, `Missing ${name} job`)
  return selected
}

function commandStep(selected: Job, stage: string) {
  const step = selected.steps?.find(step => step.run?.includes(`--stage ${stage}`))
  assert.ok(step, `Missing bootstrap ${stage} command`)
  return step
}

function assertGenericSelection(step: Step) {
  assert.equal(step.env?.BOOTSTRAP_PACKAGE, expression('inputs.package'))
  assert.equal(step.env?.BOOTSTRAP_VERSION, expression('inputs.version'))
  assert.equal(step.env?.BOOTSTRAP_TAG, expression('inputs.tag || \'alpha\''))
  assert.match(step.run ?? '', /--package "\$BOOTSTRAP_PACKAGE" --version "\$BOOTSTRAP_VERSION" --tag "\$BOOTSTRAP_TAG"/)
}

describe('repoctl bootstrap workflow', () => {
  it('selects one generic package, prerelease version and non-latest tag', () => {
    const inputs = workflow.on.workflow_dispatch.inputs
    assert.ok(inputs.mode?.options?.includes('bootstrap'))
    for (const name of ['package', 'version', 'tag', 'verify-run-id']) {
      assert.equal(inputs[name]?.type, 'string')
      assert.equal(inputs[name]?.required, false)
    }
    assert.equal(inputs.tag?.default, 'alpha')
    assert.equal(inputs['dry-run']?.type, 'boolean')
    assert.equal(inputs['dry-run']?.default, false)
    for (const [name, stage] of [
      ['bootstrap-prepare', 'prepare'],
      ['bootstrap-publish', 'publish'],
      ['bootstrap-verify', 'verify'],
    ] as const) {
      assertGenericSelection(commandStep(job(name), stage))
    }
  })

  it('prepares the frozen source without repository writes or OIDC permission', () => {
    const prepare = job('bootstrap-prepare')
    assert.equal(prepare.if, expression('github.event_name == \'workflow_dispatch\' && inputs.mode == \'bootstrap\' && inputs.verify-run-id == \'\''))
    assert.deepEqual(prepare.permissions, { contents: 'read' })
    const checkout = prepare.steps?.find(step => step.uses?.startsWith('actions/checkout@'))
    assert.equal(checkout?.with?.ref, expression('github.sha'))
    assert.equal(checkout?.with?.['fetch-depth'], 0)
    assert.equal(checkout?.with?.['persist-credentials'], false)
    assert.ok(prepare.steps?.some(step => step.run === 'pnpm install --frozen-lockfile --ignore-scripts'))
    const command = commandStep(prepare, 'prepare')
    assert.equal(command.env?.BOOTSTRAP_DRY_RUN, expression('inputs.dry-run'))
    assert.equal(command.env?.BOOTSTRAP_SOURCE_SHA, expression('inputs.source-sha'))
    assert.match(command.run ?? '', /if \[ -n "\$BOOTSTRAP_SOURCE_SHA" \]/)
    assert.match(command.run ?? '', /args\+=\(--dry-run\)/)
    assert.doesNotMatch(command.run ?? '', /--stage publish|npm publish/)
  })

  it('publishes the prepared artifact in an OIDC job without checking out or building candidate code', () => {
    const publish = job('bootstrap-publish')
    assert.equal(workflow.concurrency, undefined)
    assert.deepEqual(publish.concurrency, {
      'group': `npm-release-${expression('github.ref')}`,
      'cancel-in-progress': false,
    })
    assert.deepEqual(publish.concurrency, job('release').concurrency)
    assert.equal(publish.needs, 'bootstrap-prepare')
    assert.equal(publish.if, expression('!cancelled() && github.event_name == \'workflow_dispatch\' && inputs.mode == \'bootstrap\' && inputs.verify-run-id == \'\' && !inputs.dry-run && needs.bootstrap-prepare.result == \'success\''))
    assert.deepEqual(publish.permissions, { 'contents': 'read', 'actions': 'read', 'id-token': 'write' })
    const command = commandStep(publish, 'publish')
    assert.equal(command['working-directory'], expression('runner.temp'))
    assert.match(command.run ?? '', /--run-id "\$GITHUB_RUN_ID" --run-attempt "\$GITHUB_RUN_ATTEMPT"/)
    assert.doesNotMatch(command.run ?? '', /npm publish|pnpm exec|--stage prepare|--dry-run/)
  })

  it('recovers publication evidence through a read-only verifier that cannot publish', () => {
    const verify = job('bootstrap-verify')
    assert.deepEqual(verify.needs, ['bootstrap-prepare', 'bootstrap-publish'])
    assert.equal(verify.if, expression('!cancelled() && github.event_name == \'workflow_dispatch\' && inputs.mode == \'bootstrap\' && !inputs.dry-run && (inputs.verify-run-id != \'\' || needs.bootstrap-publish.result == \'success\')'))
    assert.deepEqual(verify.permissions, { contents: 'read', actions: 'read' })
    const command = commandStep(verify, 'verify')
    assert.equal(command['working-directory'], expression('runner.temp'))
    assert.equal(command.env?.BOOTSTRAP_VERIFY_RUN_ID, expression('inputs.verify-run-id || github.run_id'))
    assert.match(command.run ?? '', /--verify-run-id "\$BOOTSTRAP_VERIFY_RUN_ID"/)
    assert.doesNotMatch(command.run ?? '', /--stage publish|--stage prepare|npm publish|--publish/)
  })

  it('runs publisher and verifier from the same installed official, exact repoctl release', () => {
    const installed = JSON.parse(readFileSync(new URL('../node_modules/repoctl/package.json', import.meta.url), 'utf8')) as PackageManifest
    const version = rootPackage.devDependencies?.repoctl
    assert.match(version ?? '', /^\d+\.\d+\.\d+$/)
    assert.equal(installed.version, version)
    for (const name of ['bootstrap-publish', 'bootstrap-verify']) {
      const selected = job(name)
      assert.equal(selected.env?.REPOCTL_BOOTSTRAP_TOOL_VERSION, version)
      const tool = selected.steps?.find(step => step.id === 'bootstrap-tool')
      assert.equal(tool?.run, 'npm install --prefix "$RUNNER_TEMP/repoctl-bootstrap-tool" --ignore-scripts --no-package-lock --no-audit --no-fund "repoctl@$REPOCTL_BOOTSTRAP_TOOL_VERSION" --registry=https://registry.npmjs.org')
      const stage = name === 'bootstrap-publish' ? 'publish' : 'verify'
      assert.match(commandStep(selected, stage).run ?? '', /^node "\$RUNNER_TEMP\/repoctl-bootstrap-tool\/node_modules\/repoctl\/bin\/repo\.js" release bootstrap /)
      for (const step of selected.steps ?? []) {
        assert.doesNotMatch(step.uses ?? '', /actions\/checkout@/)
        assert.doesNotMatch(step.run ?? '', /\bpnpm\b|tooling:build|\b(?:git clone|npm run|npx)\b/)
        assert.equal(step.env?.NODE_AUTH_TOKEN, undefined)
        assert.equal(step.env?.NPM_TOKEN, undefined)
        assert.equal(step.env?.VSCE_PAT, undefined)
      }
    }
  })

  it('binds each immutable artifact to its run and attempt and preserves only portable preparation output', () => {
    const artifacts = [
      ['bootstrap-prepare', 'repoctl-bootstrap', '!inputs.dry-run'],
      ['bootstrap-publish', 'repoctl-bootstrap-publication', '!cancelled()'],
      ['bootstrap-verify', 'repoctl-bootstrap-verification', '!cancelled()'],
    ] as const
    for (const [name, prefix, condition] of artifacts) {
      const artifact = job(name).steps?.find(step => step.uses?.startsWith('actions/upload-artifact@'))
      assert.ok(artifact)
      assert.match(artifact.uses ?? '', /^actions\/upload-artifact@[\da-f]{40}$/)
      assert.equal(artifact.if, expression(condition))
      assert.equal(artifact.with?.name, `${prefix}-${expression('github.run_id')}-${expression('github.run_attempt')}`)
      assert.notEqual(artifact.with?.overwrite, true)
      assert.equal(artifact.with?.['if-no-files-found'], 'error')
      assert.equal(artifact.with?.['retention-days'], 14)
    }
    const prepared = job('bootstrap-prepare').steps?.find(step => step.uses?.startsWith('actions/upload-artifact@'))
    assert.deepEqual(String(prepared?.with?.path).trim().split(/\r?\n/), [
      `${expression('runner.temp')}/repoctl-bootstrap/bootstrap-manifest.json`,
      `${expression('runner.temp')}/repoctl-bootstrap/tarballs/`,
    ])
  })

  it('removes the WXML-specific publisher and routes both release checks through this contract', () => {
    assert.equal(existsSync(new URL('../.github/workflows/wxml-preview.yml', import.meta.url)), false)
    assert.equal(existsSync(new URL('./wxmlPreview', import.meta.url)), false)
    const release = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8')
    assert.doesNotMatch(release, /wxmlPreview|wxml-preview|@weapp-vite\/wxml/)
    for (const script of ['test:release', 'test:pr-actions']) {
      assert.ok(rootPackage.scripts?.[script]?.includes('scripts/repoctl-bootstrap-workflow.test.ts'))
      assert.doesNotMatch(rootPackage.scripts?.[script] ?? '', /wxmlPreview|wxml-preview/)
    }
  })
})
