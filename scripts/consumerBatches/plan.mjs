import assert from 'node:assert/strict'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { createConsumerBatchPlan } from './contracts.mjs'
import { freezeConsumerIdentity } from './identity.mjs'

export async function writeConsumerBatchPlan(provenanceFile, output) {
  const provenance = JSON.parse(await readFile(provenanceFile, 'utf8'))
  assert.equal(provenance.schemaVersion, 1, 'Invalid consumer provenance')
  const plan = createConsumerBatchPlan(freezeConsumerIdentity(provenance.identity))
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(plan, null, 2)}\n`)
  return plan
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [provenance, output] = process.argv.slice(2)
  assert(provenance && output, 'Expected <consumer provenance> <plan output>')
  const plan = await writeConsumerBatchPlan(provenance, output)
  if (process.env.GITHUB_OUTPUT) {
    const matrix = [1, 2, 3, 4].map(shard => ({ shard, install_playwright: plan.tasks.some(task => task.shardIndex === shard && task.installPlaywright) }))
    await appendFile(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify(matrix)}\n`)
  }
}
