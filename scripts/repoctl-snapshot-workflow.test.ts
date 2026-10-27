import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { getSnapshotWorkflows } from 'repoctl'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface Step {
  uses?: string
  run?: string
  with?: Record<string, unknown>
}

interface Job {
  environment?: string
  needs?: string | string[]
  permissions?: Record<string, string>
  steps?: Step[]
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
  it('consumes the native workflow pair with the repository approval and pnpm pin', async () => {
    const [manifest, policy, build, publish] = await Promise.all([
      read('package.json'),
      read('.github/pr-admission.json'),
      read('.github/workflows/repoctl-snapshot-build.yml'),
      read('.github/workflows/repoctl-snapshot-publish.yml'),
    ])
    const { packageManager } = JSON.parse(manifest) as { packageManager: string }
    const { environment } = JSON.parse(policy) as { environment: string }
    const pnpmVersion = /^pnpm@([^+]+)/u.exec(packageManager)?.[1]
    expect(pnpmVersion).toBeTruthy()
    const native = await getSnapshotWorkflows({ pnpmVersion, environment })
    expect(build).toBe(native.build)
    expect(publish).toBe(native.publish)
    const publisher = parse(publish) as Workflow
    expect(publisher.env.SNAPSHOT_BUILDER_SHA256).toBe(createHash('sha256').update(build).digest('hex'))
  })

  it('runs candidate builds only after approval with read-only permissions', async () => {
    const builder = parse(await read('.github/workflows/repoctl-snapshot-build.yml')) as Workflow
    const { environment } = JSON.parse(await read('.github/pr-admission.json')) as { environment: string }
    expect(Object.keys(builder.on)).toEqual(['workflow_dispatch'])
    expect(builder.permissions).toEqual({ contents: 'read' })
    expect(builder.jobs.freeze?.environment).toBe(environment)
    expect(builder.jobs.freeze?.needs).toBeUndefined()
    expect(builder.jobs.build?.needs).toBe('freeze')
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
    expect(publisher.jobs.publish?.needs).toBe('verify')
    expect(publisher.jobs.publish?.permissions?.['id-token']).toBe('write')
    expect(publisher.jobs.consumer?.needs).toBe('publish')
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
