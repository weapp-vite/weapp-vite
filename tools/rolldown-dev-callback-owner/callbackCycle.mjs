import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { setImmediate as nextJob, setTimeout as wait } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const fixtureSource = 'export const marker = "callback-cycle"\n'

function createObserver() {
  const first = Promise.withResolvers()
  void first.promise.catch(() => {})
  const state = { outputCount: 0, outputHash: undefined, chunks: [], error: undefined, hmrCalls: 0, assetCalls: 0 }
  return {
    first: first.promise,
    state,
    fail(error) {
      state.error = String(error)
      first.reject(error)
    },
    output(result) {
      if (result instanceof Error) {
        throw result
      }
      const chunks = result.output.filter(item => item.type === 'chunk')
      assert.ok(chunks.some(item => item.code.includes('callback-cycle')))
      state.chunks = chunks.map(item => ({ fileName: item.fileName, code: item.code }))
      state.outputHash = createHash('sha256').update(state.chunks.map(item => item.code).join('\n')).digest('hex')
      state.outputCount += 1
      first.resolve()
    },
  }
}

// 独立工厂只捕获holder和标量observer，不捕获runner的外部根容器。
function createCapturedHolder(observer) {
  const holder = { _engine: undefined, marker: 'holder' }
  return {
    holder,
    options: {
      watch: { enabled: false },
      onOutput: (result) => {
        try {
          assert.equal(holder.marker, 'holder')
          observer.output(result)
        }
        catch (error) {
          observer.fail(error)
        }
      },
      onHmrUpdates: (result) => {
        try {
          assert.equal(holder.marker, 'holder')
          observer.state.hmrCalls += 1
          if (result instanceof Error) {
            throw result
          }
        }
        catch (error) {
          observer.fail(error)
        }
      },
      onAdditionalAssets: () => {
        try {
          assert.equal(holder.marker, 'holder')
          observer.state.assetCalls += 1
        }
        catch (error) {
          observer.fail(error)
        }
      },
    },
  }
}

async function bounded(promise, name) {
  let timer
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${name} timed out`)), 10_000)
    })])
  }
  finally {
    clearTimeout(timer)
  }
}

async function runChild(mode, fixture) {
  assert.ok(['intact', 'severed'].includes(mode))
  assert.equal(typeof globalThis.gc, 'function')
  assert.ok(!process.env.NODE_OPTIONS?.trim(), 'Run without injected Node loaders')
  assert.ok(!process.env.ROLLDOWN_BINDING_PATH, 'Use the installed package binding')
  assert.ok(!process.env.ROLLDOWN_LIFECYCLE_BUILD_REPORT, 'Use the installed package binding')
  const packageJson = JSON.parse(await readFile(new URL(import.meta.resolve('rolldown/package.json')), 'utf8'))
  const { dev } = await import('rolldown/experimental')
  const roots = { holder: undefined, engine: undefined, graph: undefined }
  const weak = {}
  const finalized = { holder: false, engine: false, graph: false }
  const registry = new FinalizationRegistry((name) => {
    finalized[name] = true
  })
  const observer = createObserver()
  const samples = []
  let closed = false
  let gcCalls = 0
  const failures = []
  let status = 'running'

  async function buildAndClose() {
    const captured = createCapturedHolder(observer)
    roots.holder = captured.holder
    const engine = await bounded(dev(
      { cwd: fixture, input: 'entry.js', experimental: { devMode: true } },
      { dir: join(fixture, 'dist'), format: 'esm' },
      captured.options,
    ), 'create')
    roots.engine = engine
    roots.graph = engine.moduleGraph
    captured.holder._engine = engine
    for (const name of Object.keys(roots)) {
      weak[name] = new WeakRef(roots[name])
      registry.register(roots[name], name)
    }
    await bounded(engine.run(), 'run')
    await bounded(engine.ensureCurrentBuildFinish(), 'ensure')
    await bounded(observer.first, 'output')
    await bounded(engine.close(), 'close')
    closed = true
  }

  async function gcPhase(phase, expectFinalizers) {
    const started = performance.now()
    const deadline = started + (expectFinalizers ? 5_000 : 0)
    let rounds = 0
    do {
      await nextJob()
      globalThis.gc()
      gcCalls += 1
      rounds += 1
      await nextJob()
      await wait(50)
    } while (rounds < 3 || (!Object.values(finalized).every(Boolean) && performance.now() < deadline))
    samples.push({
      phase,
      rounds,
      elapsedMs: performance.now() - started,
      strongRoots: Object.fromEntries(Object.entries(roots).map(([name, value]) => [name, value !== undefined])),
      weakReachable: Object.fromEntries(Object.entries(weak).map(([name, ref]) => [name, ref.deref() !== undefined])),
      finalized: { ...finalized },
    })
  }

  try {
    assert.equal(await readFile(join(fixture, 'entry.js'), 'utf8'), fixtureSource)
    await buildAndClose()
    await gcPhase('closed-held', false)
    if (mode === 'severed') {
      roots.holder._engine = undefined
    }
    roots.holder = undefined
    roots.engine = undefined
    roots.graph = undefined
    await gcPhase('released-external-roots', true)
    assert.equal(observer.state.error, undefined)
    assert.equal(observer.state.outputCount, 1)
    assert.equal(observer.state.hmrCalls, 0)
    assert.equal(observer.state.assetCalls, 0)
    status = 'observed'
  }
  catch (error) {
    failures.push({ name: error.name, message: error.message, stack: error.stack })
    status = 'failed'
    process.exitCode = 1
  }
  finally {
    if (roots.engine && !closed) {
      try {
        await bounded(roots.engine.close(), 'cleanup close')
        closed = true
      }
      catch (error) {
        failures.push({ phase: 'cleanup', message: error.message })
        status = 'failed'
        process.exitCode = 1
      }
    }
    process.stdout.write(`${JSON.stringify({
      diagnosticOnly: true,
      acceptance: false,
      mode,
      status,
      failures,
      packageVersion: packageJson.version,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      fixture,
      closed,
      watchEnabled: false,
      builds: 1,
      gcCalls,
      output: observer.state,
      samples,
      explanation: 'Weak/finalizer evidence only. Output code is unmodified. No custom native, private fields, native counters, collect or performance claim.',
    })}\n`)
  }
}

async function runParent(reportArgument) {
  const record = { diagnosticOnly: true, acceptance: false, version: 2, status: 'running', mechanism: 'inconclusive', scriptSha256: createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex'), runs: [], fixture: undefined, cleanup: { fixtureRemoved: false }, failures: [] }
  let reportPath
  let fixture
  let interrupted = false
  let activeStop
  const onInterrupt = () => {
    interrupted = true
    activeStop?.()
  }
  process.on('SIGINT', onInterrupt)
  process.on('SIGTERM', onInterrupt)
  async function persist() {
    if (reportPath) {
      await writeFile(reportPath, `${JSON.stringify(record, null, 2)}\n`)
    }
  }
  async function runOwnedChild(mode) {
    assert.equal(interrupted, false, 'Interrupted before starting next owned child')
    assert.deepEqual(await readdir(fixture), ['entry.js'])
    assert.equal(await readFile(join(fixture, 'entry.js'), 'utf8'), fixtureSource)
    const item = { mode, pid: undefined, childExited: false, timeout: false, interrupted: false, stdout: '', stderr: '' }
    record.runs.push(item)
    await persist()
    const child = spawn(process.execPath, ['--expose-gc', fileURLToPath(import.meta.url), '--child', mode, fixture], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    item.pid = child.pid
    let spawnError
    let forceTimer
    const stopOwnedChild = () => {
      if (!item.childExited) {
        child.kill('SIGTERM')
      }
      clearTimeout(forceTimer)
      forceTimer = setTimeout(() => {
        if (!item.childExited) {
          child.kill('SIGKILL')
        }
      }, 5_000)
    }
    activeStop = stopOwnedChild
    const timer = setTimeout(() => {
      item.timeout = true
      stopOwnedChild()
    }, 90_000)
    child.stdout.setEncoding('utf8').on('data', (data) => {
      item.stdout += data
    })
    child.stderr.setEncoding('utf8').on('data', (data) => {
      item.stderr += data
    })
    child.on('error', (error) => {
      spawnError = error
    })
    try {
      item.outcome = await new Promise(resolve => child.on('close', (code, signal) => {
        item.childExited = true
        resolve({ code, signal })
      }))
      item.interrupted = interrupted
      if (spawnError) {
        item.spawnError = { name: spawnError.name, message: spawnError.message }
      }
      try {
        item.result = JSON.parse(item.stdout.trim())
      }
      catch (error) {
        item.parseError = error.message
      }
      // 先持久化未修改的stdout及已解析子报告，再作任何结果比较或断言。
      await persist()
      assert.equal(spawnError, undefined)
      assert.equal(item.interrupted, false, 'Interrupted after cleaning the owned child')
      assert.equal(item.timeout, false, 'Owned child timed out')
      assert.equal(item.outcome.code, 0, `${mode} failed; see raw child report`)
      assert.ok(item.result, `${mode} did not emit parseable JSON; raw stdout/stderr retained`)
      assert.equal(item.result.mode, mode)
      assert.equal(item.result.fixture, fixture)
      assert.equal(item.result.status, 'observed')
      return item.result
    }
    finally {
      clearTimeout(timer)
      clearTimeout(forceTimer)
      activeStop = undefined
      // 仅在当前精确child退出后清空其内容，保留父进程创建的同一个目录给第二进程。
      if (item.childExited) {
        for (const name of await readdir(fixture)) {
          await rm(join(fixture, name), { recursive: true, force: true })
        }
        item.fixtureContentsReset = (await readdir(fixture)).length === 0
      }
      await persist()
    }
  }
  try {
    if (reportArgument) {
      const candidate = resolve(reportArgument)
      await writeFile(candidate, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' })
      reportPath = candidate
    }
    fixture = await mkdtemp(join(tmpdir(), 'rolldown-callback-cycle-'))
    record.fixture = { path: fixture, parentCreated: true, sharedByBothChildren: true }
    if (reportPath) {
      const rel = relative(fixture, reportPath)
      assert.ok(rel.startsWith('..') || isAbsolute(rel), 'Report must live outside the owned fixture')
    }
    await persist()
    await writeFile(join(fixture, 'entry.js'), fixtureSource)
    record.intact = await runOwnedChild('intact')
    await writeFile(join(fixture, 'entry.js'), fixtureSource)
    record.severed = await runOwnedChild('severed')
    await persist()
    const { intact, severed } = record
    record.comparison = { sameVersion: intact.packageVersion === severed.packageVersion, sameOutputHash: intact.output.outputHash === severed.output.outputHash, sameChunks: JSON.stringify(intact.output.chunks) === JSON.stringify(severed.output.chunks) }
    await persist()
    assert.equal(record.comparison.sameVersion, true)
    assert.equal(record.comparison.sameOutputHash, true, 'Output hashes differ; both raw reports and unmodified code retained')
    assert.equal(record.comparison.sameChunks, true, 'Output chunks differ; unmodified code retained')
    const last = result => result.samples.at(-1)
    const recovered = result => Object.values(last(result).finalized).every(Boolean)
      && Object.values(last(result).weakReachable).every(value => !value)
    const retained = Object.values(last(intact).weakReachable).every(Boolean)
      && Object.values(last(intact).finalized).every(value => !value)
    record.mechanism = retained && recovered(severed)
      ? 'capture-cycle-supported'
      : recovered(intact) && recovered(severed) ? 'no-retention-observed' : 'inconclusive'
    record.knownResult = record.mechanism === 'capture-cycle-supported'
      ? 'retention-observed; this is a red regression case'
      : record.mechanism
    record.status = 'observed'
  }
  catch (error) {
    record.failures.push({ name: error.name, message: error.message, stack: error.stack })
    record.status = 'failed'
    process.exitCode = 1
  }
  finally {
    if (fixture && record.runs.every(item => item.childExited)) {
      try {
        await rm(fixture, { recursive: true, force: true })
        record.cleanup.fixtureRemoved = true
      }
      catch (error) {
        record.failures.push({ phase: 'fixture-cleanup', message: error.message })
        process.exitCode = 1
        record.status = 'failed'
      }
    }
    process.off('SIGINT', onInterrupt)
    process.off('SIGTERM', onInterrupt)
    try {
      await persist()
    }
    finally {
      process.stdout.write(`${JSON.stringify(record, null, 2)}\n`)
    }
  }
}

async function main() {
  if (process.argv[2] === '--child') {
    await runChild(process.argv[3], process.argv[4])
  }
  else {
    assert.ok(process.argv.length === 2 || (process.argv.length === 4 && process.argv[2] === '--report'), 'Usage: node callbackCycle.mjs [--report output.json]')
    await runParent(process.argv[3])
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`)
  process.exitCode = 1
})
