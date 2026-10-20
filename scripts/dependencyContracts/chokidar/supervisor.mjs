import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { MANAGED_PROJECT_JOURNAL_ENV } from '../../../packages/weapp-ide-cli/src/index.ts'

export function workerEnvironment(scopeEnvironment, inheritedEnvironment = process.env) {
  assert.ok(typeof MANAGED_PROJECT_JOURNAL_ENV === 'string' && MANAGED_PROJECT_JOURNAL_ENV)
  const environment = { ...inheritedEnvironment, ...scopeEnvironment }
  delete environment[MANAGED_PROJECT_JOURNAL_ENV]
  return environment
}

export async function runScenario(scenario, fixtureRoot, environment, installed, signal) {
  const started = performance.now()
  const execution = await new Promise((resolve) => {
    // 直接启动当前 Node 可执行文件，不依赖 Windows 的 .cmd 或 shell 命令解析。
    const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./worker.mjs', import.meta.url)), scenario.id, fixtureRoot], {
      cwd: process.cwd(),
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
    }, 90000)
    signal.addEventListener('abort', interrupt, { once: true })
    if (signal.aborted) {
      interrupt()
    }
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      launchError = String(error)
    })
    child.on('close', (code, childSignal) => {
      clearTimeout(timer)
      clearTimeout(forceTimer)
      signal.removeEventListener('abort', interrupt)
      let report
      let parseError
      try {
        report = JSON.parse(stdout)
      }
      catch (error) { parseError = String(error) }
      resolve({ id: scenario.id, pid: child.pid, code, signal: childSignal, timedOut, interrupted, launchError, parseError, report, stdout, stderr })
    })
  })
  const cleanupErrors = []
  let ownedTempRecords = 0
  try {
    assert.ok(!execution.timedOut && !execution.interrupted && !execution.signal, 'Terminated workers cannot claim cleanup')
    assert.equal(execution.launchError, undefined)
    assert.equal(execution.parseError, undefined)
    const records = execution.stderr.split(/\r?\n/)
      .filter(line => line.startsWith('{"type":"owned-temp-root"'))
      .map(line => JSON.parse(line))
    ownedTempRecords = records.length
    assert.equal(records.length, 1, 'One exact worker fixture ownership record is required')
    assert.equal(records[0].scenario, scenario.id)
    const relative = path.relative(fixtureRoot, records[0].root)
    assert.ok(relative.startsWith('scenario-') && !relative.includes(path.sep) && !path.isAbsolute(relative), 'Worker fixture must be the exact direct mkdtemp child of this supervisor')
    assert.equal(execution.report?.id, scenario.id)
    assert.deepEqual(execution.report?.installed, { version: installed.version, hashes: installed.hashes }, 'Worker and supervisor must resolve the same installed formal dependency')
    const cleanup = execution.report?.cleanup
    assert.equal(cleanup?.nativeCleanupConfirmed, true)
    assert.equal(cleanup?.deletedTempRoot, true)
    assert.equal(cleanup?.machineLeaseReleased, true)
    assert.deepEqual(cleanup?.forcedNativeCloses, [], 'Diagnostic forced close can never produce a passing cleanup')
    assert.deepEqual(cleanup?.cleanupErrors, [])
    assert.ok(execution.report?.native, 'Real native handle observations are required')
    assert.ok(execution.report.native.handles.every(handle => handle.closed))
    assert.ok(execution.report.native.pollingHandles.every(handle => handle.stopped))
    await assert.rejects(access(records[0].root), { code: 'ENOENT' })
  }
  catch (error) {
    cleanupErrors.push({ message: String(error), stack: error?.stack })
  }
  const cleanupConfirmed = cleanupErrors.length === 0
  const passed = execution.code === 0 && execution.report?.status === 'passed' && cleanupConfirmed
  return {
    ...execution,
    status: passed ? 'passed' : 'failed',
    workerStarted: execution.pid !== undefined,
    durationMs: performance.now() - started,
    cleanupConfirmed,
    controllerCleanup: { ownedTempRecords, repairedTempRoot: false, errors: cleanupErrors },
  }
}
