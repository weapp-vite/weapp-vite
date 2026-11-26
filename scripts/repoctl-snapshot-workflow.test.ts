/* eslint-disable no-template-curly-in-string -- GitHub Actions expressions are asserted as literals. */
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { getSnapshotWorkflows } from 'repoctl'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface Step {
  name?: string
  uses?: string
  run?: string
  with?: Record<string, unknown>
}

interface Job {
  environment?: string
  needs?: string | string[]
  outputs?: Record<string, string>
  uses?: string
  permissions?: Record<string, string>
  steps?: Step[]
  env?: Record<string, string>
}

interface Workflow {
  on: Record<string, unknown>
  env: Record<string, string>
  permissions: Record<string, string>
  jobs: Record<string, Job>
}

const root = new URL('../', import.meta.url)
const read = (file: string) => readFile(new URL(file, root), 'utf8')

describe('repoctl prepared snapshot integration', () => {
  it('uses the root manifest toolchain with the native snapshot workflow baseline', async () => {
    const [manifest, policy, build, publish] = await Promise.all([
      read('package.json'),
      read('.github/pr-admission.json'),
      read('.github/workflows/repoctl-snapshot-build.yml'),
      read('.github/workflows/repoctl-snapshot-publish.yml'),
    ])
    const { packageManager, devDependencies } = JSON.parse(manifest) as { packageManager: string, devDependencies?: Record<string, string> }
    const { environment } = JSON.parse(policy) as { environment: string }
    const pnpmVersion = /^pnpm@([^+]+)/u.exec(packageManager)?.[1]
    expect(pnpmVersion).toBeTruthy()
    const repoctlVersion = devDependencies?.repoctl
    expect(repoctlVersion).toMatch(/^\d+\.\d+\.\d+$/u)
    const native = await getSnapshotWorkflows({ pnpmVersion: pnpmVersion!, environment })
    expect(native.build).toContain(`repoctl@${repoctlVersion} pnpm@${pnpmVersion}`)
    expect(native.publish).toContain(`repoctl@${repoctlVersion} pnpm@${pnpmVersion}`)
    expect(parse(build).jobs.toolchain?.uses).toBe('./.github/workflows/reusable-repoctl-toolchain.yml')
    expect(parse(publish).jobs.toolchain?.uses).toBe('./.github/workflows/reusable-repoctl-toolchain.yml')
    expect(build).toContain('"repoctl@$REPOCTL_VERSION" "pnpm@$PNPM_VERSION"')
    expect(publish).toContain('"repoctl@$REPOCTL_VERSION" "pnpm@$PNPM_VERSION"')
    expect(build).not.toMatch(/repoctl@\d+\.\d+\.\d+/u)
    expect(publish).not.toMatch(/repoctl@\d+\.\d+\.\d+/u)
    expect(build).not.toMatch(/pnpm@\d+\.\d+\.\d+/u)
    expect(publish).not.toMatch(/pnpm@\d+\.\d+\.\d+/u)
    const publisher = parse(publish) as Workflow
    const digest = createHash('sha256').update(build).digest('hex')
    expect(publisher.env.SNAPSHOT_BUILDER_SHA256).toBe(digest)
  })

  it('resolves exact toolchain versions from the trusted root manifest', async () => {
    const toolchain = parse(await read('.github/workflows/reusable-repoctl-toolchain.yml')) as {
      on: { workflow_call: { outputs: Record<string, { value: string }> } }
      jobs: Record<string, Job>
    }
    expect(toolchain.on.workflow_call.outputs.repoctl_version.value).toBe('${{ jobs.resolve.outputs.repoctl_version }}')
    expect(toolchain.on.workflow_call.outputs.pnpm_version.value).toBe('${{ jobs.resolve.outputs.pnpm_version }}')
    const checkout = toolchain.jobs.resolve.steps?.find(step => step.uses?.startsWith('actions/checkout@'))
    expect(checkout?.with).toMatchObject({
      'ref': '${{ github.event.repository.default_branch }}',
      'sparse-checkout': 'package.json',
      'sparse-checkout-cone-mode': false,
      'persist-credentials': false,
    })
    const versions = toolchain.jobs.resolve.steps?.find(step => step.name === 'Read exact versions from package.json')
    expect(versions?.run).toContain('manifest.devDependencies?.repoctl')
    expect(versions?.run).toContain('manifest.packageManager')
  })

  it('runs candidate builds only after approval with read-only permissions', async () => {
    const builder = parse(await read('.github/workflows/repoctl-snapshot-build.yml')) as Workflow
    const { environment } = JSON.parse(await read('.github/pr-admission.json')) as { environment: string }
    expect(Object.keys(builder.on)).toEqual(['workflow_dispatch'])
    expect(builder.permissions).toEqual({ contents: 'read' })
    expect(builder.jobs.freeze?.environment).toBe(environment)
    expect(builder.jobs.freeze?.needs).toBe('toolchain')
    expect(builder.jobs.build?.needs).toEqual(['freeze', 'toolchain'])
    expect(builder.jobs.build?.permissions).toEqual({ contents: 'read' })
    for (const job of Object.values(builder.jobs)) {
      expect(Object.values(job.permissions ?? {})).not.toContain('write')
      for (const step of job.steps ?? []) {
        if (step.uses?.startsWith('actions/checkout@')) {
          expect(step.with?.['persist-credentials']).toBe(false)
        }
      }
    }
  })

  it('isolates publishing credentials from candidate checkout and consumer execution', async () => {
    const publisher = parse(await read('.github/workflows/repoctl-snapshot-publish.yml')) as Workflow
    expect(Object.keys(publisher.on)).toEqual(['workflow_run'])
    expect(publisher.permissions).toEqual({ contents: 'read' })
    expect(publisher.jobs.publish?.needs).toEqual(['verify', 'toolchain'])
    expect(publisher.jobs.publish?.permissions?.['id-token']).toBe('write')
    expect(publisher.jobs.consumer?.needs).toEqual(['publish', 'toolchain'])
    expect(publisher.jobs.consumer?.permissions).toEqual({ contents: 'read' })
    for (const [name, job] of Object.entries(publisher.jobs)) {
      if (name !== 'publish') {
        expect(job.permissions?.['id-token']).toBeUndefined()
      }
      for (const step of job.steps ?? []) {
        expect(step.uses ?? '').not.toMatch(/^actions\/checkout@/u)
      }
    }
    const commands = publisher.jobs.publish?.steps?.map(step => step.run ?? '').join('\n') ?? ''
    expect(commands).toContain('release snapshot publish-prepared')
    expect(commands).not.toMatch(/snapshot prepare|verify-consumer|pnpm install/u)
  })
})
