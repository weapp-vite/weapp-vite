/* eslint-disable antfu/no-import-dist */
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { AcceptanceService, defaultVerification, detectProject } from '../../packages/agent-mini-program/dist/index.mjs'

// This intentionally writes configuration in a disposable, installed test fixture.
const root = process.env.WEAPP_AGENT_ACCEPTANCE_FIXTURE
if (!root) {
  throw new Error('Set WEAPP_AGENT_ACCEPTANCE_FIXTURE to a disposable installed native/Wevu fixture with a real test AppID and pages/agent-proof/index (#count, #increment). The fixture configuration will be replaced.')
}
const project = await detectProject(root)
const artifacts = path.resolve(import.meta.dirname, '../../artifacts/weapp-agent/acceptance-live', project.kind)
await mkdir(artifacts, { recursive: true })
const scenario = JSON.parse(await readFile(new URL('../../examples/weapp-agent/acceptance/counter.json', import.meta.url), 'utf8'))
const scenarioPath = path.join(root, 'acceptance-counter.json')
const config = {
  version: 1,
  verification: defaultVerification(project),
  acceptance: { requiredChecks: ['build', 'devtools'], scenarios: ['acceptance-counter.json'] },
}
await writeFile(path.join(root, 'weapp-agent.config.json'), JSON.stringify(config, null, 2))
await writeFile(scenarioPath, JSON.stringify(scenario, null, 2))
const reports = []
const service = await AcceptanceService.create(root)
async function run(label, trusted = true) {
  if (trusted) {
    const grant = await AcceptanceService.create(root, { trust: true })
    await grant.close()
  }
  {
    const started = await service.start()
    const report = await service.wait(started.jobId)
    reports.push({ label, report })
    await writeFile(path.join(artifacts, `${label}.json`), JSON.stringify(report, null, 2))
    for (const artifact of report.artifacts) {
      const data = await service.artifact(report.jobId, artifact.name)
      await writeFile(path.join(artifacts, `${label}-${artifact.name}`), data.data, data.mediaType === 'image/png' ? 'base64' : 'utf8')
    }
    return report
  }
}
try {
  const success = await run('passed')
  assert.equal(success.passed, true, JSON.stringify(success))
  assert.equal(success.runtime, 'wechat-devtools')
  assert(success.artifacts.some(a => a.mediaType === 'image/png'))
  assert(success.artifacts.some(a => a.name === 'console.json'))
  scenario.steps.findLast(step => step.action === 'assert').text = '2'
  scenario.steps.findLast(step => step.action === 'assert').timeoutMs = 500
  await writeFile(scenarioPath, JSON.stringify(scenario, null, 2))
  const blocked = await run('changed-scenario-needs-review', false)
  assert.equal(blocked.status, 'action_required')
  const failed = await run('injected-assertion-failure')
  assert.equal(failed.passed, false)
  assert(failed.steps.some(step => step.action === 'assert' && step.status === 'failed'))
  scenario.steps.findLast(step => step.action === 'assert').text = '1'
  await writeFile(scenarioPath, JSON.stringify(scenario, null, 2))
  assert.equal((await run('repaired-scenario')).passed, true)
  console.log('PASS: real DevTools acceptance, assertion failure, changed-scenario authorization, and rerun. No real-model/host/physical-device claim.')
}
finally {
  await service.close()
  await writeFile(path.join(artifacts, 'summary.json'), JSON.stringify(reports.map(({ label, report }) => ({ label, jobId: report.jobId, status: report.status, passed: report.passed })), null, 2))
}
