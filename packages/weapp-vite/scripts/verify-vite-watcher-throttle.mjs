import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { observePhase } from './watcherThrottleDiagnostic/phase.mjs'
import { fault, requireFact, safeError, sha256 } from './watcherThrottleDiagnostic/support.mjs'

const repo = process.cwd()
const output = path.resolve(repo, '.cache/web-watcher-throttle/primitive.json')
const cancellation = new AbortController()
const onInterrupt = () => cancellation.abort(fault('CANCELLED_SIGINT'))
const onTerminate = () => cancellation.abort(fault('CANCELLED_SIGTERM'))
const report = {
  diagnosticOnly: true,
  productFailureReproduced: false,
  productFixVerified: false,
  complete: false,
  node: process.version,
  platform: process.platform,
  phases: [],
  generatedAt: new Date().toISOString(),
  timeOriginMs: performance.timeOrigin,
}
const context = { report, cancellation, forceOwnProcessExit: false }
let outputOwned = false

process.on('SIGINT', onInterrupt)
process.on('SIGTERM', onTerminate)
try {
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  outputOwned = true
  requireFact(process.platform === 'linux' && process.version === 'v24.18.0', 'DIAGNOSTIC_HOST_MISMATCH')
  const require = createRequire(path.join(repo, 'package.json'))
  report.vite = JSON.parse(await readFile(require.resolve('vite/package.json'), 'utf8')).version
  requireFact(report.vite === '8.3.2', 'VITE_VERSION_MISMATCH')
  const viteEntry = require.resolve('vite')
  report.viteEntrySha256 = sha256(await readFile(viteEntry))
  const { withMachineE2ELease } = await import(pathToFileURL(path.join(repo, 'packages/devtools-runtime/src/lease/machine.ts')).href)
  await withMachineE2ELease(async (lease) => {
    requireFact(lease.borrowed, 'OWNED_COMMAND_WRAPPER_REQUIRED')
    report.machineLease = 'verified-borrowed-scope'
    const { createServer } = await import(pathToFileURL(viteEntry).href)
    for (const requestedDelayMs of [20, 80]) {
      await observePhase(createServer, requestedDelayMs, context)
      await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
    }
  })
  cancellation.signal.throwIfAborted()
  report.complete = true
}
catch (error) {
  report.error = safeError(error)
  process.exitCode = 1
}
finally {
  process.off('SIGINT', onInterrupt)
  process.off('SIGTERM', onTerminate)
  report.signalListenersRemoved = true
  report.forcedOwnProcessExit = context.forceOwnProcessExit
  try {
    if (outputOwned) {
      await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
    }
  }
  catch {
    process.exitCode = 1
  }
}
console.log(`[watcher-throttle] complete=${report.complete}; ${report.phases.map(phase => `${phase.requestedDelayMs}ms:${phase.outcome}`).join(', ')}; diagnostic only, not product acceptance`)
// 关闭未确认时仅终止本脚本；外层 owned command 仍核验其进程组并管理租约。
if (context.forceOwnProcessExit) {
  process.exit(1)
}
