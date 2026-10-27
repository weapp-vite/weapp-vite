import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { assertConsumerEvidence, assertConsumerExecutionIdentity } from '../consumerBatches/identity.mjs'
import { aggregateNodeSupport } from './contracts.mjs'

/** Node 角色验收必须同时回读消费者和 Dashboard 原始证据。 */
export async function aggregateNodeSupportDirectory(plan, reportsRoot, commit) {
  assertConsumerExecutionIdentity(plan.identity)
  const directories = (await readdir(reportsRoot, { withFileTypes: true })).filter(entry => entry.isDirectory())
  const entries = await Promise.all(directories.map(async (entry) => {
    const directory = path.join(reportsRoot, entry.name)
    return { directory, report: JSON.parse(await readFile(path.join(directory, 'node-support.json'), 'utf8')) }
  }))
  const result = aggregateNodeSupport(plan, entries.map(entry => entry.report), commit)
  for (const { report, directory } of entries) {
    const consumerBytes = await readFile(path.join(directory, 'consumer-evidence.json'))
    const dashboardBytes = await readFile(path.join(directory, 'dashboard-public-types.json'))
    const digest = bytes => createHash('sha256').update(bytes).digest('hex')
    assert.equal(digest(consumerBytes), report.consumerHash, 'Node consumer evidence digest mismatch')
    assert.equal(digest(dashboardBytes), report.dashboardHash, 'Node Dashboard evidence digest mismatch')
    assertConsumerEvidence(JSON.parse(consumerBytes.toString('utf8')), plan.identity, 'wv', report.node)
    const dashboard = JSON.parse(dashboardBytes.toString('utf8'))
    assert.equal(dashboard.node.replace(/^v/u, ''), report.node, 'Dashboard Node evidence mismatch')
    assert.equal(dashboard.passed, true, 'Dashboard public types did not pass')
  }
  return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [planFile, reportsRoot, output, commit] = process.argv.slice(2)
  assert(planFile && reportsRoot && output && commit, 'Expected <plan> <reports directory> <output> <commit>')
  const report = await aggregateNodeSupportDirectory(JSON.parse(await readFile(planFile, 'utf8')), reportsRoot, commit)
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
}
