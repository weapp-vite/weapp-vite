import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { readWorkflowFixture } from '../workflowFixture.mjs'

interface Step {
  name?: string
  run?: string
  if?: string
  uses?: string
  env?: Record<string, unknown>
  with?: Record<string, unknown>
}
interface Workflow {
  on: Record<string, unknown>
  permissions: Record<string, string>
  jobs: Record<string, {
    permissions: Record<string, string>
    concurrency: Record<string, unknown>
    steps: Step[]
  }>
}
const workflow = readWorkflowFixture('wxml-preview.yml') as Workflow
const job = workflow.jobs.preview!
const guard = job.steps[0]!

function expression(value: string) {
  return '$' + `{{ ${value} }}`
}

describe('WXML preview publishing boundary', () => {
  it('runs only by explicit dispatch with a frozen source and no stored publishing token', () => {
    expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch'])
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(job.permissions).toEqual({ 'contents': 'read', 'id-token': 'write' })
    expect(job.concurrency).toEqual({ 'group': `npm-release-${expression('github.ref')}`, 'cancel-in-progress': false })
    const checkout = job.steps.find(step => step.uses?.startsWith('actions/checkout@'))!
    expect(checkout.with).toEqual({ 'ref': expression('github.sha'), 'persist-credentials': false })
    expect(guard.env).toEqual({ DEFAULT_BRANCH: expression('github.event.repository.default_branch') })
    for (const step of job.steps) {
      expect(step.env?.NODE_AUTH_TOKEN).toBeUndefined()
      expect(step.env?.NPM_TOKEN).toBeUndefined()
      expect(step.env?.GITHUB_TOKEN).toBeUndefined()
    }
  })

  it.runIf(process.platform !== 'win32').each([
    ['main', 'refs/heads/main', '0.1.0-alpha.0', 0],
    ['main', 'refs/heads/main', '0.1.0-alpha.12', 0],
    ['main', 'refs/heads/alpha', '0.1.0-alpha.0', 1],
    ['main', 'refs/tags/main', '0.1.0-alpha.0', 1],
    ['', 'refs/heads/main', '0.1.0-alpha.0', 1],
    ['main', 'refs/heads/main', '0.1.0', 1],
    ['main', 'refs/heads/main', '0.1.0-alpha.00', 1],
    ['main', 'refs/heads/main', '0.1.0-alpha.0\necho injected', 1],
  ])('guards branch %s / ref %s / version %s before checkout', (branch, ref, version, status) => {
    const result = spawnSync('bash', ['--noprofile', '--norc', '-eu', '-c', guard.run!], {
      encoding: 'utf8',
      env: { DEFAULT_BRANCH: String(branch), GITHUB_REF: String(ref), PREVIEW_VERSION: String(version) },
    })
    expect(result.status).toBe(status)
  })

  it('checks and rebuilds the package before packing and only publishes the exact tarball to alpha', () => {
    const check = job.steps.findIndex(step => step.name === 'Check the public WXML package')
    const pack = job.steps.findIndex(step => step.name === 'Prepare the exact preview tarball')
    const publish = job.steps.findIndex(step => step.name === 'Publish using npm OIDC')
    expect(check).toBeGreaterThan(0)
    expect(pack).toBeGreaterThan(check)
    expect(publish).toBeGreaterThan(pack)
    expect(job.steps[check]?.run).toContain('pnpm --filter @weapp-vite/wxml build')
    expect(job.steps[check]?.run).toContain('pnpm --filter @weapp-vite/wxml test:types:check')
    expect(job.steps[publish]?.run).toBe('npm publish "$PREVIEW_TARBALL" --ignore-scripts --access public --tag alpha --provenance --registry=https://registry.npmjs.org')
    for (const name of ['Publish using npm OIDC', 'Confirm registry integrity, tag and provenance', 'Verify the published package in an isolated consumer']) {
      expect(job.steps.find(step => step.name === name)?.if).toBe(expression('!inputs.dry-run'))
    }
    const consumer = job.steps.find(step => step.name === 'Verify the published package in an isolated consumer')!
    expect(consumer.run).toContain('"@weapp-vite/wxml@$PREVIEW_VERSION"')
    expect(consumer.run).toContain('npm audit signatures')
  })
})
