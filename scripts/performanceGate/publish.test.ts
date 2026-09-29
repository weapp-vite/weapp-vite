import { Buffer } from 'node:buffer'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'
import { parse } from 'yaml'
import { policy, shards, smokeMetrics } from './contract.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const repository = 'owner/repo'
const headSha = 'a'.repeat(40)
const prNumber = 7

function smokeReport() {
  return {
    schemaVersion: 2,
    purpose: 'smoke',
    prNumber,
    headSha,
    driverSha: headSha,
    baselineSha: policy.baselineSha,
    samplingContract: policy.samplingContract,
    status: 'passed',
    fullAcceptance: 'not-run',
    errors: [],
    executionPlan: { headOnly: true, metrics: shards.flatMap(smokeMetrics), confirmation: [] },
    stages: shards.map(shard => ({
      shard,
      values: smokeMetrics(shard).map(id => ({
        id,
        ms: 1,
        output: { pageCount: 1, configDigest: 'b'.repeat(64), templateDigest: 'c'.repeat(64) },
      })),
    })),
  }
}

it.each(['passed', 'missing', 'wrong-head', 'wrong-pr', 'skipped', 'failed'] as const)('publishes smoke evidence downloaded by the workflow: %s', async (scenario) => {
  const workflow = parse(await readFile(path.join(root, '.github/workflows/ci-performance-comment.yml'), 'utf8'))
  const download = workflow.jobs['report-v2'].steps.find((step: { uses?: string, if?: string }) => step.uses?.startsWith('actions/download-artifact@') && (!step.if || step.if.includes('\'Performance Smoke\'')))
  const publish = workflow.jobs['report-v2'].steps.find((step: { run?: string }) => step.run === 'node scripts/performanceGate/publish.mjs')
  const temp = await mkdtemp(path.join(os.tmpdir(), 'performance-publish-'))
  const comments: Array<{ body: string }> = []
  const unexpected: string[] = []
  const pull = { number: prNumber, state: 'open', head: { sha: headSha, ref: 'feature', repo: { full_name: repository } }, labels: [] }
  const run = { id: 10, name: 'Performance Smoke', event: 'pull_request', path: '.github/workflows/ci-performance.yml', head_sha: headSha, head_branch: 'feature', head_repository: { full_name: repository }, conclusion: scenario === 'failed' ? 'failure' : 'success' }
  const server = createServer(async (req, res) => {
    const endpoint = req.url?.replace(`/repos/${repository}`, '').split('?')[0]
    let response: unknown
    if (endpoint === '/actions/runs/10') {
      response = run
    }
    else if (endpoint === `/commits/${headSha}/pulls`) {
      response = [pull]
    }
    else if (endpoint === `/commits/${headSha}/statuses`) {
      response = []
    }
    else if (endpoint === '/actions/runs/10/jobs') {
      response = { jobs: [{ steps: [{ name: 'Run correctness smoke', conclusion: scenario === 'skipped' ? 'skipped' : run.conclusion }] }] }
    }
    else if (endpoint === `/pulls/${prNumber}/files`) {
      response = [{ filename: 'README.md' }]
    }
    else if (endpoint === `/pulls/${prNumber}`) {
      response = pull
    }
    else if (endpoint === `/issues/${prNumber}/comments`) {
      response = []
      if (req.method === 'POST') {
        const chunks = []
        for await (const chunk of req) {
          chunks.push(chunk)
        }
        comments.push(JSON.parse(Buffer.concat(chunks).toString()) as { body: string })
      }
    }
    else {
      unexpected.push(`${req.method} ${req.url}`)
      res.statusCode = 404
    }
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(response ?? {}))
  })
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Missing test server address')
    }
    if (['passed', 'wrong-head', 'wrong-pr'].includes(scenario)) {
      // download-artifact v5+ 对唯一匹配直接解压至 path，即使 merge-multiple 为 false。
      const destination = path.join(temp, download.with.path)
      await mkdir(destination, { recursive: true })
      const report = smokeReport()
      if (scenario === 'wrong-head') {
        report.headSha = 'd'.repeat(40)
      }
      if (scenario === 'wrong-pr') {
        report.prNumber++
      }
      await writeFile(path.join(destination, 'smoke.json'), JSON.stringify(report))
    }
    const eventFile = path.join(temp, 'event.json')
    await writeFile(eventFile, JSON.stringify({ workflow_run: { id: run.id } }))
    const result = promisify(execFile)(process.execPath, [path.join(import.meta.dirname, 'publish.mjs')], {
      cwd: temp,
      env: { ...process.env, GITHUB_EVENT_PATH: eventFile, GITHUB_REPOSITORY: repository, GITHUB_TOKEN: 'test-only', GITHUB_API_URL: `http://127.0.0.1:${address.port}`, PERFORMANCE_ARTIFACTS: publish.env.PERFORMANCE_ARTIFACTS },
      timeout: 10_000,
    })
    if (['passed', 'skipped', 'failed'].includes(scenario)) {
      await expect(result).resolves.toMatchObject({ stderr: '' })
      expect(comments).toHaveLength(1)
      expect(comments[0]!.body).toContain(scenario === 'passed' ? '✅ 正确性冒烟通过' : scenario === 'skipped' ? '无需冒烟（无关路径变更）' : '🔴 未通过')
    }
    else {
      await expect(result).rejects.toThrow(scenario === 'missing' ? 'ENOENT' : scenario === 'wrong-head' ? 'Invalid smoke report identity' : 'Smoke target or execution mismatch')
      expect(comments).toHaveLength(0)
    }
    expect(unexpected).toEqual([])
  }
  finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    await rm(temp, { recursive: true, force: true })
  }
})
