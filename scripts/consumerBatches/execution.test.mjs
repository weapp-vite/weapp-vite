import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aggregateNodeSupportDirectory } from '../nodeSupport/aggregate.mjs'
import { createNodeSupportPlan } from '../nodeSupport/contracts.mjs'
import { aggregateConsumerBatchDirectory } from './aggregate.mjs'
import { createConsumerBatchPlan } from './contracts.mjs'
import { freezeConsumerIdentity } from './identity.mjs'
import { runConsumerBatch } from './run.mjs'

const roots = []
afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(roots.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'consumer-batch-contract-'))
  roots.push(directory)
  for (const [key, value] of Object.entries({ GITHUB_REPOSITORY: 'example/project', GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2', BUILD_ARTIFACT_EXPECTED_COMMIT: 'a'.repeat(40) })) {
    vi.stubEnv(key, value)
  }
  const identity = freezeConsumerIdentity({ commit: 'a'.repeat(40), os: process.platform, arch: process.arch, packageManager: 'pnpm@11.0.0' })
  return { directory, identity, plan: createConsumerBatchPlan(identity) }
}

const rawConsumer = (identity, host, node = identity.builderNode) => ({ schemaVersion: 1, node: `v${node}`, platform: identity.os, arch: identity.arch, toolchain: host })
const json = value => `${JSON.stringify(value)}\n`
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

function executor(identity) {
  return vi.fn(async (_command, args, options) => {
    if (options.env?.WEAPP_VITE_CONSUMER_EVIDENCE) {
      await writeFile(options.env.WEAPP_VITE_CONSUMER_EVIDENCE, json(rawConsumer(identity, args[1])))
    }
    return { exitCode: 0 }
  })
}

describe('consumer completion and downloaded evidence', () => {
  it('executes every original scenario independently and rereads the exact evidence bytes', async () => {
    const { directory, identity, plan } = await fixture()
    const execute = executor(identity)
    for (const shard of [1, 2, 3, 4]) {
      await runConsumerBatch(plan, shard, path.join(directory, `shard-${shard}`), { execute })
    }
    expect(execute.mock.calls.filter(([, , options]) => options.env?.WEAPP_VITE_CONSUMER_EVIDENCE)).toHaveLength(32)
    expect((await aggregateConsumerBatchDirectory(plan, directory, identity.commit)).scenarios).toHaveLength(32)
    const first = plan.tasks.find(task => task.shardIndex === 1)
    const filename = path.join(directory, 'shard-1', `${first.host}-${first.profile}.json`)
    await writeFile(filename, json({ ...rawConsumer(identity, first.host), node: 'v0.0.1' }))
    await expect(aggregateConsumerBatchDirectory(plan, directory, identity.commit)).rejects.toThrow('digest')
    await rm(filename)
    await expect(aggregateConsumerBatchDirectory(plan, directory, identity.commit)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it.each(['failure', 'cancellation'])('keeps %s incomplete even if the early installation evidence exists', async (mode) => {
    const { directory, identity, plan } = await fixture()
    const controller = new AbortController()
    const writeEvidence = executor(identity)
    const execute = vi.fn(async (...args) => {
      await writeEvidence(...args)
      if (mode === 'cancellation') {
        controller.abort()
      }
      return { exitCode: mode === 'failure' ? 1 : 0 }
    })
    await expect(runConsumerBatch(plan, 1, directory, { execute, signal: controller.signal })).rejects.toThrow('incomplete')
    const report = JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8'))
    expect(report.status).toBe('failed')
    expect(report.results.slice(1).every(result => result.status === 'not-executed')).toBe(true)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('rejects another attempt before executing or aggregating any scenario', async () => {
    const { directory, identity, plan } = await fixture()
    vi.stubEnv('GITHUB_RUN_ATTEMPT', '3')
    const execute = executor(identity)
    await expect(runConsumerBatch(plan, 1, directory, { execute })).rejects.toThrow('attempt')
    await expect(aggregateConsumerBatchDirectory(plan, directory, identity.commit)).rejects.toThrow('attempt')
    expect(execute).not.toHaveBeenCalled()
  })
})

it('rereads Node role evidence and refuses missing or mutated consumer and Dashboard artifacts', async () => {
  const { directory, identity } = await fixture()
  const minimums = { 22: '22.23.4', 24: '24.22.1', 26: '26.12.1' }
  const plan = createNodeSupportPlan(identity, minimums, minimums)
  for (const row of plan.matrix) {
    const output = path.join(directory, row.id)
    await mkdir(output)
    const consumer = json(rawConsumer(identity, 'wv', row.node))
    const dashboard = json({ node: `v${row.node}`, passed: true })
    await writeFile(path.join(output, 'consumer-evidence.json'), consumer)
    await writeFile(path.join(output, 'dashboard-public-types.json'), dashboard)
    await writeFile(path.join(output, 'node-support.json'), json({ schemaVersion: 1, identity, planHash: plan.planHash, node: row.node, roles: row.roles, status: 'passed', consumerHash: digest(consumer), dashboardHash: digest(dashboard) }))
  }
  expect((await aggregateNodeSupportDirectory(plan, directory, identity.commit)).logicalRoles).toHaveLength(5)
  const target = path.join(directory, plan.matrix[0].id, 'dashboard-public-types.json')
  await writeFile(target, json({ node: `v${plan.matrix[0].node}`, passed: false }))
  await expect(aggregateNodeSupportDirectory(plan, directory, identity.commit)).rejects.toThrow('digest')
  await rm(target)
  await expect(aggregateNodeSupportDirectory(plan, directory, identity.commit)).rejects.toMatchObject({ code: 'ENOENT' })
})
