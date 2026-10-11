import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 独立 Windows 首次查询检查复用真实启动与有界退出，不重试。
import { execa } from 'execa'
import { redact } from './identity'

assert.equal(process.platform, 'win32', 'Run this check in a fresh Windows Node 22 or 24 job.')
assert.equal(process.argv.length, 2, 'This check accepts no selector, retry or budget override.')
const reportFile = path.resolve('.tmp/windows-journal-self-writer/report.json')
await mkdir(path.dirname(reportFile), { recursive: true })
const report: Record<string, unknown> = {
  status: 'running',
  workflowCommit: process.env.GITHUB_SHA,
  node: process.version,
  runnerImage: process.env.ImageOS,
  runnerImageVersion: process.env.ImageVersion,
  startedAt: new Date().toISOString(),
  queryBudgetMs: 10_000,
  supervisorBudgetMs: 30_000,
  attempts: 1,
}
const persist = () => writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`)
await persist()
try {
  const child = await execa(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./selfWriterWorker.ts', import.meta.url))], {
    timeout: 30_000,
    reject: false,
    windowsHide: true,
  })
  assert.equal(child.exitCode, 0, `Worker failed: ${redact(child.stderr)}`)
  assert.equal(child.timedOut, false, 'Worker supervisor expired; this is not an identity pass.')
  const result: unknown = JSON.parse(child.stdout)
  assert.ok(result && typeof result === 'object' && 'status' in result && result.status === 'passed')
  report.result = result
  report.status = 'passed'
}
catch (error) {
  report.status = 'failed'
  report.error = redact(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
finally {
  report.finishedAt = new Date().toISOString()
  await persist()
  console.log(JSON.stringify(report))
}
