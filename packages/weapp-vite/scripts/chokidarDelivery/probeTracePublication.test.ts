import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, it, vi } from 'vitest'
import { waitForFile } from './probe/fixture.mjs'
import { assertOutput, openPublicOwner } from './probe/public.mjs'
import { createDeliveryTrace } from './probe/trace.mjs'

const harness = vi.hoisted(() => ({
  watchTestArtifact: vi.fn(),
  reads: [] as string[],
  readError: undefined as Error | undefined,
}))

vi.mock('weapp-vite/test', () => ({ watchTestArtifact: harness.watchTestArtifact }))
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    async readFile(...args: Parameters<typeof actual.readFile>) {
      harness.reads.push(String(args[0]))
      if (harness.readError) {
        throw harness.readError
      }
      return actual.readFile(...args)
    },
  }
})

let root: string
let trace: ReturnType<typeof createDeliveryTrace>

beforeEach(async () => {
  vi.stubEnv('WEAPP_VITE_DELIVERY_TRACE', '1')
  root = await mkdtemp(path.join(os.tmpdir(), 'delivery-trace-publication-'))
  trace = createDeliveryTrace(root, root, new Error('injected'))
  harness.reads.length = 0
  harness.readError = undefined
  harness.watchTestArtifact.mockReset().mockImplementation(async ({ outDir }) => ({
    artifact: { miniprogramRootPath: outDir },
    close: async () => {},
  }))
})

afterEach(async () => {
  trace.restore()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await rm(root, { recursive: true, force: true })
})

it('trace 与自然发布共用一次现场读取，公开回调返回原始 publication Promise', async () => {
  const owner = await openPublicOwner('artifact', root, [], [])
  const file = path.join(owner.outDir, 'marker.txt')
  await mkdir(owner.outDir, { recursive: true })
  await writeFile(file, 'published')
  const ticket = owner.publications.expectOutput('marker.txt', 'published')
  const published = vi.spyOn(owner.publications, 'onRebuilt')
  const callback = harness.watchTestArtifact.mock.calls[0]![0].onRebuilt
  const returned = callback({ miniprogramRootPath: owner.outDir })
  assert.equal(returned, published.mock.results[0]!.value)
  await returned
  await ticket.completed
  assert.deepEqual(harness.reads, [file])
  const rows = trace.snapshot().rows
  assert.equal(rows.filter(row => row.stage === 'artifact.published').length, 1)
  assert.deepEqual(rows.filter(row => row.stage === 'output.observed').map(row => ({ exists: row.exists, text: row.text })), [{ exists: true, text: 'published' }])
  ticket.dispose()
})

it('trace 不吞 publication 读取原错，回调与本次 ticket 保留同一 rejection', async () => {
  const owner = await openPublicOwner('artifact', root, [], [])
  const ticket = owner.publications.expectOutput('marker.txt', 'published')
  const original = new Error('publication read failed')
  harness.readError = original
  const published = vi.spyOn(owner.publications, 'onRebuilt')
  const returned = harness.watchTestArtifact.mock.calls[0]![0].onRebuilt({ miniprogramRootPath: owner.outDir })
  assert.equal(returned, published.mock.results[0]!.value)
  await assert.rejects(returned, error => error === original)
  await assert.rejects(ticket.completed, error => error === original)
  assert.deepEqual(harness.reads, [path.join(owner.outDir, 'marker.txt')])
  ticket.dispose()
})

it('公开输出观察适配 options，trace 只记录同一次真实读取', async () => {
  const owner = { kind: 'host', outDir: root, trace }
  const file = path.join(root, 'marker.txt')
  await writeFile(file, 'visible')
  await assertOutput(owner, 'marker.txt', 'visible')
  assert.deepEqual(harness.reads, [file])
  assert.deepEqual(trace.snapshot().rows.map(row => row.stage), ['assert.enter', 'output.observed', 'assert.passed'])
})

it('被动观察仍受原 deadline 与读取前后 AbortSignal 约束，不追加等待或读取', async () => {
  const file = path.join(root, 'marker.txt')
  await writeFile(file, 'visible')
  await assert.rejects(waitForFile(file, 'visible', { deadline: Date.now() - 1 }), { code: 'ERR_ASSERTION' })
  assert.deepEqual(harness.reads, [])
  const controller = new AbortController()
  const original = new Error('cancelled during observation')
  const observed: unknown[] = []
  await assert.rejects(waitForFile(file, 'visible', {
    signal: controller.signal,
    observe(value) {
      observed.push(value)
      controller.abort(original)
    },
  }), error => error === original)
  assert.deepEqual(harness.reads, [file])
  assert.deepEqual(observed, [{ exists: true, text: 'visible' }])
  await assert.rejects(waitForFile(file, 'visible', { signal: controller.signal }), error => error === original)
  assert.deepEqual(harness.reads, [file])
})
