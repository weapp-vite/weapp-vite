import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { aggregateConsumerBatches } from './contracts.mjs'
import { assertConsumerEvidence, assertConsumerExecutionIdentity } from './identity.mjs'

async function readReports(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const reports = await Promise.all(entries.map(async (entry) => {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      return readReports(filename)
    }
    if (entry.isFile() && entry.name === 'report.json') {
      const value = JSON.parse(await readFile(filename, 'utf8'))
      return value.schemaVersion === 1 && value.planHash && Number.isInteger(value.shardIndex) ? [{ report: value, directory }] : []
    }
    return []
  }))
  return reports.flat()
}

/** 汇总回读下载的原始字节与平台证据，缺失或篡改不能仅凭摘要字符串通过。 */
export async function aggregateConsumerBatchDirectory(plan, reportsRoot, commit) {
  assertConsumerExecutionIdentity(plan.identity)
  const entries = await readReports(reportsRoot)
  const result = aggregateConsumerBatches(plan, entries.map(entry => entry.report), commit)
  for (const { report, directory } of entries) {
    for (const scenario of report.results) {
      const task = plan.tasks.find(task => task.id === scenario.id)
      assert(scenario.evidence === `${task.host}-${task.profile}.json`, 'Consumer evidence path mismatch')
      const bytes = await readFile(path.join(directory, scenario.evidence))
      assert.equal(createHash('sha256').update(bytes).digest('hex'), scenario.evidenceHash, 'Consumer evidence digest mismatch')
      assertConsumerEvidence(JSON.parse(bytes.toString('utf8')), plan.identity, task.host, plan.identity.builderNode)
    }
  }
  return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [planFile, reportsRoot, output, commit] = process.argv.slice(2)
  assert(planFile && reportsRoot && output && commit, 'Expected <plan> <reports directory> <output> <commit>')
  const report = await aggregateConsumerBatchDirectory(JSON.parse(await readFile(planFile, 'utf8')), reportsRoot, commit)
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
}
