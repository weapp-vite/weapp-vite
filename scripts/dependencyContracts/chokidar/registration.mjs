import assert from 'node:assert/strict'
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { turn } from './support.mjs'

export async function recreateAndExercise(owner, ctx, directory = ctx.target, file = ctx.image) {
  const { timeoutMs } = ctx
  const add = owner.event('add', file, timeoutMs)
  await mkdir(directory, { recursive: true })
  await writeFile(file, 'recreated image')
  await add
  assert.equal(await readFile(file, 'utf8'), 'recreated image')
  const change = owner.event('change', file, timeoutMs)
  await writeFile(file, 'changed recreated image with a different size')
  await change
  assert.equal(await readFile(file, 'utf8'), 'changed recreated image with a different size')
  const unlink = owner.event('unlink', file, timeoutMs)
  await rm(file)
  await unlink
}

export async function recover(chokidar, ctx) {
  const { scenario, root, target, watched, instrumentation, open, ready, timeoutMs } = ctx
  const options = { ignoreInitial: !!scenario.ignoreInitial }
  if (scenario.depth != null) {
    options.depth = scenario.depth
  }
  if (scenario.cwd) {
    options.cwd = root
  }
  const input = scenario.scope === 'root' ? target : watched
  const owner = open(chokidar, scenario.cwd ? path.relative(root, input) : input, options)
  await ready(owner)
  if (scenario.scope === 'root') {
    const parent = path.relative(root, path.dirname(target)).replaceAll('\\', '/') || '.'
    const native = instrumentation.snapshot()
    const acquired = native.attempts.some(attempt => attempt.path === parent && attempt.result === 'acquired')
    const active = native.handles.some(handle => handle.path === parent && !handle.closed)
    ctx.scenarioEvidence.push({ checkpoint: 'ready-after-parent-registration', parent, acquired, active })
    assert.ok(acquired && active, 'public ready must follow active fallback parent registration before root recreation')
  }
  assert.equal(ctx.injected, 1)
  await assert.rejects(access(target), { code: 'ENOENT' })
  const beforeRecreate = owner.events.slice()
  await recreateAndExercise(owner, ctx)
  assert.deepEqual(owner.errors, [], 'only the proven disappeared exact Windows watch EPERM is suppressed')
  assert.equal(beforeRecreate.some(event => event.path.startsWith(`${path.relative(root, target).replaceAll('\\', '/')}/`)), false, 'failed registration must not publish stale descendant adds')
  if (scenario.ignoreInitial) {
    assert.equal(beforeRecreate.some(event => event.event === 'add'), false)
  }
  if (scenario.cwd) {
    assert.ok(owner.events.every(event => !path.isAbsolute(event.rawPath)), 'cwd paths remain relative')
  }
  if (scenario.depth != null) {
    const deepFile = path.join(target, 'beyond-depth', 'not-observed.txt')
    const barrier = path.join(target, 'depth-barrier.txt')
    const barrierAdded = owner.event('add', barrier, timeoutMs)
    await mkdir(path.dirname(deepFile), { recursive: true })
    await writeFile(deepFile, 'created outside configured depth')
    await writeFile(barrier, 'public direct-child scan barrier')
    await barrierAdded
    assert.equal(instrumentation.attempts.some(attempt => attempt.path.includes('beyond-depth')), false, 'depth boundary does not acquire deeper native watchers')
    assert.equal(owner.events.some(event => event.event === 'add' && event.path.endsWith('beyond-depth/not-observed.txt')), false)
  }
}

export async function classify(chokidar, ctx) {
  const { scenario, root, target, instrumentation, open, ready, scenarioEvidence: evidence } = ctx
  const owner = open(chokidar)
  await ready(owner)
  assert.equal(ctx.injected, 1)
  await turn()
  if (scenario.wrongPath === 'case-only') {
    const reportedPath = path.resolve(ctx.injectedError.path)
    assert.notEqual(reportedPath, path.resolve(target), 'the reported Error path has a distinct spelling')
    assert.equal(reportedPath.toLowerCase(), path.resolve(target).toLowerCase(), 'lowercase matching would conflate these distinct path spellings')
    evidence.push({
      checkpoint: 'case-only-wrong-path-error-identity',
      scope: 'Synthetic win32 classification input; distinct spellings model a possible case-sensitive Windows directory. No claim that this host has two distinct case-only entries.',
      requestedPath: path.relative(root, target).replaceAll('\\', '/'),
      reportedPath: path.relative(root, reportedPath).replaceAll('\\', '/'),
      observedErrors: owner.errors.map(error => ({ originalError: error === ctx.injectedError, code: error.code, syscall: error.syscall })),
    })
  }
  const suppressed = instrumentation.selectedPlatform === 'win32' && scenario.remove !== false && !scenario.wrongPath && !scenario.syscall && !scenario.code && !scenario.probeError
  if (suppressed) {
    assert.deepEqual(owner.errors, [])
    await recreateAndExercise(owner, ctx)
  }
  else {
    assert.equal(owner.errors.length, 1, 'unexpected native registration errors publish once')
    assert.equal(owner.errors[0], ctx.injectedError, 'the exact original Error object must propagate')
  }
  if (scenario.probeError) {
    assert.ok(ctx.probeErrorCount > 0, 'the failing exact-path presence probe was exercised')
  }
}
