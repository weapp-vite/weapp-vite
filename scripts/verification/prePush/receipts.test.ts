import type { VerificationPlan, VerificationReport } from '../types.ts'
import type { PushTarget } from './refs.ts'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { pushReceiptKey, readPushReceipt, writePushReceipt } from './receipts.ts'

const roots = new Set<string>()
afterEach(async () => {
  await Promise.all([...roots].map(async (root) => {
    await rm(root, { recursive: true, force: true })
    roots.delete(root)
  }))
})

async function directory() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'push-receipt-'))
  roots.add(root)
  return root
}

const target: PushTarget = { localRef: 'refs/heads/feature', remoteRef: 'refs/heads/feature', localSha: 'b'.repeat(40), remoteSha: 'a'.repeat(40), head: 'b'.repeat(40), tree: 'c'.repeat(40), base: 'a'.repeat(40) }
const plan = { mode: 'quick', selection: 'affected', changes: { head: target.head, base: target.base }, fingerprint: 'frozen-plan', tasks: [{ id: 'lint' }] } as VerificationPlan
const report: VerificationReport = { version: 1, mode: 'quick', fingerprint: plan.fingerprint, startedAt: 'fixture', durationMs: 1, status: 'partial', results: [{ id: 'lint', status: 'passed', exitCode: 0, execution: 'actual', durationMs: 1 }], remaining: ['CI remains required'] }

it('reuses only exact successful local quick receipts and rejects changed candidates', async () => {
  const root = await directory()
  const file = path.join(root, 'receipt.json')
  expect(await readPushReceipt(file, 'key')).toBe(false)
  await writePushReceipt(file, 'key', target, plan, report)
  expect(await readPushReceipt(file, 'key')).toBe(true)
  expect(await readPushReceipt(file, 'new-candidate')).toBe(false)
  const saved = JSON.parse(await readFile(file, 'utf8')) as { scope: string }
  expect(saved.scope).toBe('pre-push-quick')
})

it.each(['failed', 'blocked', 'cancelled'] as const)('never records a %s task as successful', async (status) => {
  const file = path.join(await directory(), 'receipt.json')
  const changed = { ...report, results: [{ ...report.results[0]!, status }] }
  await expect(writePushReceipt(file, 'key', target, plan, changed)).rejects.toThrow('没有完整成功证据')
  expect(await readPushReceipt(file, 'key')).toBe(false)
})

it('rejects missing, duplicate and not-executed evidence', async () => {
  const file = path.join(await directory(), 'receipt.json')
  for (const results of [[], [report.results[0]!, report.results[0]!], [{ ...report.results[0]!, execution: 'not-executed' as const }]]) {
    await expect(writePushReceipt(file, 'key', target, plan, { ...report, results })).rejects.toThrow('没有完整成功证据')
  }
  await writeFile(file, '{incomplete')
  expect(await readPushReceipt(file, 'key')).toBe(false)
})

it('invalidates receipts when policy bytes, toolchain or candidate identity change', async () => {
  const root = await directory()
  await mkdir(path.join(root, 'scripts/verification'), { recursive: true })
  const policy = path.join(root, 'scripts/verification/policy.ts')
  await writeFile(policy, 'export const policy = 1\n')
  const key = await pushReceiptKey(root, { target, node: 'fixture' })
  expect(await pushReceiptKey(root, { target, node: 'fixture' })).toBe(key)
  expect(await pushReceiptKey(root, { target, node: 'different' })).not.toBe(key)
  expect(await pushReceiptKey(root, { target: { ...target, head: 'd'.repeat(40) }, node: 'fixture' })).not.toBe(key)
  await writeFile(policy, 'export const policy = 2\n')
  expect(await pushReceiptKey(root, { target, node: 'fixture' })).not.toBe(key)
})
