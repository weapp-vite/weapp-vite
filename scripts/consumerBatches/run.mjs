import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 消费者批次使用跨平台启动器并传递取消信号。
import { execa } from 'execa'
import { assertConsumerBatchPlan } from './contracts.mjs'
import { assertConsumerEvidence, assertConsumerExecutionIdentity } from './identity.mjs'

/** 每个逻辑场景仍调用原独立消费者入口；失败或取消后不再启动下一份受管资源。 */
export async function runConsumerBatch(plan, shardIndex, output, { execute = execa, signal, now = () => performance.now() } = {}) {
  assertConsumerBatchPlan(plan)
  assertConsumerExecutionIdentity(plan.identity)
  assert.equal(process.versions.node, plan.identity.builderNode, 'Consumer batch builder Node mismatch')
  assert(Number.isInteger(shardIndex) && shardIndex >= 1 && shardIndex <= plan.shards, 'Invalid consumer batch index')
  assert.equal(plan.identity.commit, process.env.BUILD_ARTIFACT_EXPECTED_COMMIT, 'Consumer batch checkout mismatch')
  const tasks = plan.tasks.filter(task => task.shardIndex === shardIndex)
  const results = []
  let failed = false
  await mkdir(output, { recursive: true })
  for (const task of tasks) {
    if (failed || signal?.aborted) {
      results.push({ id: task.id, profile: task.profile, status: 'not-executed', exitCode: null, durationMs: 0 })
      continue
    }
    const started = now()
    const evidence = path.resolve(output, `${task.host}-${task.profile}.json`)
    let exitCode = 1
    let evidenceHash
    let failureReason
    try {
      if (task.profile === 'web') {
        const preflight = await execute('pnpm', ['exec', 'vitest', 'run', '--config', 'scripts/vitest.config.mjs', 'scripts/hostCapabilityDiagnostic.test.mjs'], { stdio: 'inherit', reject: false, cancelSignal: signal })
        assert.equal(preflight.exitCode, 0, 'Consumer Web diagnostics failed')
      }
      signal?.throwIfAborted()
      const result = await execute(process.execPath, ['packages/weapp-vite/scripts/verify-vite-host-install.mjs', task.host, ...(task.profile === 'consumer' ? [] : ['headless', task.profile])], {
        stdio: 'inherit',
        reject: false,
        cancelSignal: signal,
        env: {
          WEAPP_VITE_CONSUMER_EVIDENCE: evidence,
          WEAPP_VITE_CONSUMER_HOST_DIAGNOSTICS: task.profile === 'web' ? '1' : '',
        },
      })
      exitCode = result.exitCode ?? 1
      assert.equal(exitCode, 0, `Consumer scenario failed: ${task.id}`)
      const bytes = await readFile(evidence)
      const observed = JSON.parse(bytes.toString('utf8'))
      assertConsumerEvidence(observed, plan.identity, task.host, plan.identity.builderNode)
      evidenceHash = createHash('sha256').update(bytes).digest('hex')
    }
    catch (error) {
      failureReason = error.message
      failed = true
    }
    results.push({ id: task.id, profile: task.profile, status: failed ? 'failed' : 'passed', exitCode, durationMs: now() - started, evidence: path.basename(evidence), evidenceHash, failureReason })
    await writeFile(path.join(output, 'report.json'), `${JSON.stringify({ schemaVersion: 1, identity: plan.identity, planHash: plan.planHash, shardIndex, status: 'partial', results }, null, 2)}\n`)
  }
  const report = { schemaVersion: 1, identity: plan.identity, planHash: plan.planHash, shardIndex, status: failed || signal?.aborted ? 'failed' : 'passed', results }
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  assert.equal(report.status, 'passed', 'Consumer batch incomplete; see per-scenario evidence')
  return report
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [planFile, shard, output] = process.argv.slice(2)
  const controller = new AbortController()
  const abort = () => controller.abort()
  process.once('SIGINT', abort)
  process.once('SIGTERM', abort)
  try {
    await runConsumerBatch(JSON.parse(await readFile(planFile, 'utf8')), Number(shard), output, { signal: controller.signal })
  }
  finally {
    process.removeListener('SIGINT', abort)
    process.removeListener('SIGTERM', abort)
  }
}
