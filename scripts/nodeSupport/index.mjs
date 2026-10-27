import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { assertConsumerEvidence, assertConsumerExecutionIdentity, freezeConsumerIdentity } from '../consumerBatches/identity.mjs'
import { assertNodeSupportPlan, createNodeSupportPlan, minimumNodeVersions, normalizedNodeVersion } from './contracts.mjs'

async function writeJson(output, value) {
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(value, null, 2)}\n`)
}

export async function recordNodeSupport(plan, version, consumerFile, dashboardFile, output) {
  assertNodeSupportPlan(plan)
  assertConsumerExecutionIdentity(plan.identity)
  const node = normalizedNodeVersion(version)
  assert.equal(node, process.versions.node, 'Node support runner version mismatch')
  const expected = plan.matrix.find(row => row.node === node)
  assert(expected, 'Node version was not selected by the frozen plan')
  const [consumerBytes, dashboardBytes] = await Promise.all([readFile(consumerFile), readFile(dashboardFile)])
  const consumer = JSON.parse(consumerBytes.toString('utf8'))
  const dashboard = JSON.parse(dashboardBytes.toString('utf8'))
  assert.equal(normalizedNodeVersion(consumer.node), node, 'Consumer Node evidence mismatch')
  assert.equal(normalizedNodeVersion(dashboard.node), node, 'Dashboard Node evidence mismatch')
  assertConsumerEvidence(consumer, plan.identity, 'wv', node)
  assert.equal(dashboard.passed, true, 'Dashboard public types did not pass')
  const digest = bytes => createHash('sha256').update(bytes).digest('hex')
  const report = { schemaVersion: 1, identity: plan.identity, planHash: plan.planHash, node, roles: expected.roles, status: 'passed', consumerHash: digest(consumerBytes), dashboardHash: digest(dashboardBytes) }
  await writeJson(output, report)
  return report
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...args] = process.argv.slice(2)
  if (command === 'plan') {
    const [provenanceFile, output, latest22, latest24] = args
    const provenance = JSON.parse(await readFile(provenanceFile, 'utf8'))
    const manifest = JSON.parse(await readFile('package.json', 'utf8'))
    const plan = createNodeSupportPlan(freezeConsumerIdentity(provenance.identity), minimumNodeVersions(manifest.engines.node), { 22: latest22, 24: latest24 })
    await writeJson(output, plan)
    if (process.env.GITHUB_OUTPUT) {
      await appendFile(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify(plan.matrix)}\n`)
    }
  }
  else if (command === 'record') {
    const [planFile, version, consumerFile, dashboardFile, output] = args
    await recordNodeSupport(JSON.parse(await readFile(planFile, 'utf8')), version, consumerFile, dashboardFile, output)
  }
  else {
    throw new Error('Expected node support plan or record')
  }
}
