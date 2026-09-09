import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, open, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

async function main() {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  if (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== sha) {
    throw new Error('Diagnostic checkout does not match workflow SHA.')
  }
  const rawRoot = path.resolve(process.argv[2] ?? path.join(root, '.tmp/workspace-hmr-profile'))
  await mkdir(path.dirname(rawRoot), { recursive: true })
  await mkdir(rawRoot, { recursive: false })
  await writeFile(path.join(rawRoot, 'metadata.json'), JSON.stringify({
    diagnosticOnly: true,
    sha,
    sourceBaseSha: execFileSync('git', ['rev-parse', 'HEAD^'], { cwd: root, encoding: 'utf8' }).trim(),
    cliSha256: createHash('sha256').update(await readFile(path.join(root, 'packages/weapp-vite/dist/cli.mjs'))).digest('hex'),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu: os.cpus()[0]?.model,
    logicalCpuCount: os.availableParallelism(),
    runnerImage: process.env.ImageVersion,
    snapshotTrace: true,
    hmrProfile: true,
    automaticRetries: false,
    plannedRounds: 3,
  }, null, 2))
  const rounds = []
  for (let round = 1; round <= 3; round++) {
    const report = path.join(rawRoot, `round-${round}`)
    await mkdir(report)
    const log = await open(path.join(report, 'dev.log'), 'wx')
    const startedAt = new Date().toISOString()
    let result
    try {
      result = await new Promise((resolve) => {
        const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./audit.ts', import.meta.url))], {
          cwd: root,
          stdio: ['ignore', log.fd, log.fd],
          env: {
            ...process.env,
            GITHUB_STEP_SUMMARY: '',
            WORKSPACE_HMR_FILTER: 'apps/wevu-jsx-tsx-demo',
            WORKSPACE_HMR_MODE: 'full',
            WORKSPACE_HMR_SCOPE: 'workspace',
            WORKSPACE_HMR_FAIL_ON_ERROR: '1',
            WORKSPACE_HMR_REPORT_DIR: report,
            WORKSPACE_HMR_STARTUP_TIMEOUT_MS: '180000',
            WORKSPACE_HMR_TIMEOUT_MS: '180000',
            WORKSPACE_HMR_SETTLE_MS: '250',
            WORKSPACE_HMR_STARTUP_DIST_STABLE_MS: '1000',
            WORKSPACE_HMR_WRITE_MODE: 'write',
            WORKSPACE_HMR_USE_POLLING: '0',
            WEAPP_VITE_STATEFUL_HMR_SNAPSHOT_TRACE: '1',
            WORKSPACE_HMR_MAX_SCENARIOS_PER_PROJECT: '3',
          },
        })
        child.once('error', () => resolve({ code: 1, signal: null, spawnFailed: true }))
        child.once('close', (code, signal) => resolve({ code, signal }))
      })
    }
    finally {
      await log.close()
    }
    rounds.push({ round, directory: `round-${round}`, startedAt, endedAt: new Date().toISOString(), ...result })
    process.stdout.write(`Workspace HMR diagnostic round-${round}: exit=${result.code ?? 'signal'}\n`)
    await writeFile(path.join(rawRoot, 'rounds.json'), JSON.stringify({ diagnosticOnly: true, planned: 3, executed: rounds.length, rounds }, null, 2))
  }
  process.exitCode = rounds.every(round => round.code === 0) ? 0 : 1
}

try {
  await main()
}
catch {
  process.stderr.write('Workspace HMR diagnostic orchestration failed; inspect raw evidence locally.\n')
  process.exitCode = 1
}
