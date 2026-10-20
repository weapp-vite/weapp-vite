import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { MANAGED_PROJECT_JOURNAL_ENV } from '../../../weapp-ide-cli/src/index.ts'
import { preparePublicWorkerScope } from './validation.mjs'

/** 非 IDE 子进程仅继承机器能力票据，不继承真实 IDE journal 或源码加载别名。 */
export function ordinaryEnvironment(scopeEnvironment = {}, inheritedEnvironment = process.env) {
  assert.ok(typeof MANAGED_PROJECT_JOURNAL_ENV === 'string' && MANAGED_PROJECT_JOURNAL_ENV)
  const environment = { ...inheritedEnvironment, ...scopeEnvironment, CHOKIDAR_USEPOLLING: 'false' }
  delete environment[MANAGED_PROJECT_JOURNAL_ENV]
  delete environment.NODE_OPTIONS
  delete environment.NODE_PATH
  return environment
}

/** 监督器仅终止本次取得的精确 Node child；不按命令名清理任何外部资源。 */
export async function runPublicWorker({ scenario, consumerRoot, resultFile, lease, repositoryRoot, signal, variant = 'candidate' }) {
  const cleanupKey = JSON.stringify({ domain: 'chokidar-delivery', variant, scenario: scenario.id, consumerRoot, resultFile, ownerPid: process.pid })
  const { scope, execution: running } = await preparePublicWorkerScope({ lease, cleanupKey, signal, start: scope => new Promise((resolve) => {
    const environment = ordinaryEnvironment(scope.environment)
    // 当前 Node 的绝对可执行文件不经过 shell，也不涉及 Windows 的 .cmd 解析。
    const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./worker.mjs', import.meta.url)), scenario.id, consumerRoot, resultFile], {
      cwd: repositoryRoot,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let interrupted = false
    let launchError
    let forceTimer
    const stop = () => {
      if (child.exitCode !== null || child.signalCode !== null || forceTimer) {
        return
      }
      child.kill('SIGTERM')
      forceTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL')
        }
      }, 5000)
    }
    const interrupt = () => {
      interrupted = true
      stop()
    }
    const timer = setTimeout(() => {
      timedOut = true
      stop()
    }, 180_000)
    signal.addEventListener('abort', interrupt, { once: true })
    if (signal.aborted) {
      interrupt()
    }
    child.stdout.on('data', chunk => stdout += chunk)
    child.stderr.on('data', chunk => stderr += chunk)
    child.on('error', error => launchError = String(error))
    child.on('close', (code, childSignal) => {
      clearTimeout(timer)
      clearTimeout(forceTimer)
      signal.removeEventListener('abort', interrupt)
      resolve({ id: scenario.id, variant, pid: child.pid, code, signal: childSignal, timedOut, interrupted, launchError, stdout, stderr })
    })
  }) })
  const execution = await running
  const result = { ...execution, status: 'failed', scope: 'active', cleanupConfirmed: false }
  try {
    assert(!execution.timedOut && !execution.interrupted && !execution.signal, 'Interrupted or killed workers cannot claim cleanup')
    assert.equal(execution.launchError, undefined)
    result.report = JSON.parse(await readFile(resultFile, 'utf8'))
    assert.equal(result.report.id, scenario.id)
    assert.equal(result.report.pid, execution.pid, 'Report must belong to the exact registered child')
    const relative = path.relative(path.join(consumerRoot, 'projects'), result.report.fixture)
    assert(relative.startsWith(`${scenario.id}-`) && !relative.includes(path.sep) && !path.isAbsolute(relative), 'Fixture must belong to the exact child scenario')
    assert.equal(result.report.cleanup.nativeCleanupConfirmed, true)
    assert.equal(result.report.cleanup.deletedFixture, true)
    assert.equal(result.report.cleanup.machineLeaseReleased, true)
    assert.deepEqual(result.report.cleanup.forcedNativeCloses, [])
    assert.deepEqual(result.report.cleanup.errors, [])
    assert(result.report.native, 'Native observations are required')
    assert(result.report.native.handles.every(item => item.closeCalls === 1 && item.closeEvents === 1))
    await assert.rejects(access(result.report.fixture), { code: 'ENOENT' })
    await scope.seal()
    result.scope = 'sealed'
    await scope.complete()
    result.scope = 'completed'
    result.cleanupConfirmed = true
    result.status = execution.code === 0 && result.report.status === 'passed' ? 'passed' : 'failed'
  }
  catch (error) {
    result.cleanupError = { message: String(error), stack: error?.stack }
    try {
      await scope.seal()
      result.scope = 'sealed'
    }
    catch (sealError) { result.sealError = { message: String(sealError), stack: sealError?.stack } }
    result.retainedCleanupBindingSha256 = createHash('sha256').update(cleanupKey).digest('hex')
  }
  return result
}
