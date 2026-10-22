import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { PassThrough } from 'node:stream'
import { setImmediate } from 'node:timers/promises'
import { afterEach, expect, it, vi } from 'vitest'
import { assertConsumerPrivateConfigRestored, consumerProcessEnvironment, readConsumerPrivateConfig, stopConsumerProcess } from './shutdown.mjs'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'consumer-shutdown-'))
  roots.push(root)
  return root
}

function controlledProcess() {
  const result = Promise.withResolvers<{ code: number, signal: null }>()
  const child = {
    pid: process.pid,
    exitCode: null as number | null,
    signalCode: null,
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
  }
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', chunk => stdout += String(chunk))
  child.stderr.on('data', chunk => stderr += String(chunk))
  // 受控进程只验证协议；失败路径不得向测试 runner 的实际 PID 发送信号。
  const forceCleanup = vi.fn(async () => undefined)
  return { child, done: result.promise, resolve: result.resolve, forceCleanup, output: () => ({ stdout, stderr }) }
}

it('preserves inherited Node options and gives legacy hosts an EOF consumer outside CI suppression', () => {
  const inherited = { CI: 'true', NODE_OPTIONS: '--no-warnings', OTHER: 'preserved' }
  const environment = consumerProcessEnvironment('stateful-dev', inherited)
  expect(environment).toMatchObject({ CI: 'false', OTHER: 'preserved' })
  expect(environment.NODE_OPTIONS).toMatch(/^--no-warnings --import=file:.*\/stdinPreload\.mjs$/)
  expect(inherited).toEqual({ CI: 'true', NODE_OPTIONS: '--no-warnings', OTHER: 'preserved' })
  expect(consumerProcessEnvironment('build-watch', inherited)).toEqual(inherited)
})

it.each(['dev', 'stateful-dev', 'build-watch'])('does not activate stdin or replace CI for explicit %s host control', (operation) => {
  const inherited = { CI: 'true', NODE_OPTIONS: '--no-warnings', OTHER: 'preserved' }
  const environment = consumerProcessEnvironment(operation, inherited, { explicitControl: true })
  expect(environment).toEqual(inherited)
  expect(environment).not.toBe(inherited)
  expect(environment.NODE_OPTIONS).not.toContain('stdinPreload')
})

it('uses EOF to let a real Node host finish cleanup and collect its final output', async () => {
  const root = await fixture()
  const original = Buffer.from('{\r\n\t"setting": { "compileHotReLoad": true }\r\n}\r\n')
  await writeFile(path.join(root, 'project.private.config.json'), original)
  const snapshot = await readConsumerPrivateConfig(root)
  const child = spawn(process.execPath, ['--input-type=module', '--eval', `
    import { writeFile } from 'node:fs/promises';
    import { setTimeout } from 'node:timers/promises';
    import process from 'node:process';
    process.stdin.on('end', async () => {
      await setTimeout(20);
      await writeFile(process.env.CONSUMER_PRIVATE_CONFIG, Buffer.from(process.env.CONSUMER_ORIGINAL, 'base64'));
      process.stdout.write('cleanup-complete\\n');
      process.stderr.write('cleanup-diagnostic\\n');
    });
    await writeFile(process.env.CONSUMER_PRIVATE_CONFIG, '{"setting":{"compileHotReLoad":false}}');
    process.stdout.write('ready\\n');
  `], {
    env: consumerProcessEnvironment('dev', {
      ...process.env,
      CI: 'true',
      CONSUMER_PRIVATE_CONFIG: path.join(root, 'project.private.config.json'),
      CONSUMER_ORIGINAL: original.toString('base64'),
    }),
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const done = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })))
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', chunk => stdout += String(chunk))
  child.stderr.on('data', chunk => stderr += String(chunk))
  try {
    await once(child.stdout, 'data', { signal: AbortSignal.timeout(5_000) })
    expect(stdout).toContain('ready\n')
    await stopConsumerProcess({ child, done, operation: 'dev', toolchain: 'vite' })
    expect(stdout).toContain('cleanup-complete\n')
    expect(stderr).toContain('cleanup-diagnostic\n')
    await assertConsumerPrivateConfigRestored(root, snapshot)
  }
  finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
    }
    await done
  }
})

it('waits for both output streams after the process exit receipt', async () => {
  const fixture = controlledProcess()
  fixture.child.stdin.once('finish', () => {
    fixture.child.exitCode = 0
    fixture.resolve({ code: 0, signal: null })
  })
  let settled = false
  const stop = stopConsumerProcess({ ...fixture, operation: 'dev', toolchain: 'wv' }).then(() => settled = true)
  await fixture.done
  await Promise.resolve()
  expect(settled).toBe(false)
  fixture.child.stdout.end('last output')
  fixture.child.stderr.end('last diagnostic')
  await stop
  expect(fixture.output()).toEqual({ stdout: 'last output', stderr: 'last diagnostic' })
})

it.each([false, true])('waits for real exit and remaining output after an EOF error (force failure=%s)', async (forceFails) => {
  const fixture = controlledProcess()
  const original = Object.assign(new Error('stdin EOF failed'), { code: 'EPIPE' })
  const cleanupError = new Error('forced cleanup failed')
  const requested = Promise.withResolvers<void>()
  vi.spyOn(fixture.child.stdin, 'end').mockImplementation(() => fixture.child.stdin.destroy(original))
  const forceCleanup = vi.fn(async () => {
    requested.resolve()
    if (forceFails) {
      throw cleanupError
    }
  })
  let settled = false
  const stop = stopConsumerProcess({ ...fixture, operation: 'dev', toolchain: 'vite-plus', forceCleanup }).then(
    () => {
      settled = true
      throw new Error('Expected failed development shutdown')
    },
    (error: unknown) => {
      settled = true
      return error as AggregateError
    },
  )
  await requested.promise
  await setImmediate()
  expect(settled).toBe(false)
  fixture.child.exitCode = 1
  fixture.resolve({ code: 1, signal: null })
  await setImmediate()
  expect(settled).toBe(false)
  fixture.child.stdout.end('late output')
  fixture.child.stderr.end('late cleanup diagnostic')
  const failure = await stop
  expect(failure).toBeInstanceOf(AggregateError)
  expect(failure).toHaveProperty('cause', original)
  expect(failure.errors).toEqual(forceFails ? [original, cleanupError] : [original])
  expect(fixture.output()).toEqual({ stdout: 'late output', stderr: 'late cleanup diagnostic' })
  expect(forceCleanup).toHaveBeenCalledOnce()
})

it.each([false, true])('bounds independent resource cleanup without losing earlier errors (force failure=%s)', async (forceFails) => {
  const fixture = controlledProcess()
  const original = Object.assign(new Error('stdin EOF failed'), { code: 'EPIPE' })
  const cleanupError = new Error('forced cleanup failed')
  vi.spyOn(fixture.child.stdin, 'end').mockImplementation(() => fixture.child.stdin.destroy(original))
  fixture.forceCleanup.mockImplementation(async () => {
    if (forceFails) {
      throw cleanupError
    }
  })
  const failure = await stopConsumerProcess({ ...fixture, operation: 'dev', toolchain: 'wv', timeoutMs: 10 }).then(
    () => { throw new Error('Expected failed development shutdown') },
    error => error as AggregateError,
  )
  expect(failure).toBeInstanceOf(AggregateError)
  expect(failure).toHaveProperty('cause', original)
  expect(failure.errors).toEqual([original, ...forceFails ? [cleanupError] : [], expect.objectContaining({ message: 'Consumer process exit or output drain timed out' })])
  expect(fixture.forceCleanup).toHaveBeenCalledOnce()
  expect(fixture.child.stdout.destroyed).toBe(true)
  expect(fixture.child.stderr.destroyed).toBe(true)
  fixture.child.exitCode = 1
  fixture.resolve({ code: 1, signal: null })
})

it('keeps a shutdown timeout failed even when forced cleanup succeeds', async () => {
  const fixture = controlledProcess()
  const forceCleanup = vi.fn(async () => {
    fixture.child.exitCode = 1
    fixture.resolve({ code: 1, signal: null })
    fixture.child.stdout.end()
    fixture.child.stderr.end()
  })
  await expect(stopConsumerProcess({ ...fixture, operation: 'dev', toolchain: 'vite-plus', timeoutMs: 10, forceCleanup }))
    .rejects
    .toMatchObject({ message: 'Native vite-plus dev did not close cleanly', cause: { message: 'Consumer process exit or output drain timed out' } })
  expect(forceCleanup).toHaveBeenCalledOnce()
})

it('rejects an ordinary nonzero development exit after all streams drain', async () => {
  const fixture = controlledProcess()
  fixture.child.stdin.once('finish', () => {
    fixture.child.exitCode = 1
    fixture.resolve({ code: 1, signal: null })
    fixture.child.stdout.end()
    fixture.child.stderr.end('original cleanup error')
  })
  await expect(stopConsumerProcess({ ...fixture, operation: 'dev', toolchain: 'wv' }))
    .rejects
    .toMatchObject({ message: 'Native wv dev did not close cleanly', cause: { message: expect.stringContaining('finish successfully') } })
  expect(fixture.output().stderr).toBe('original cleanup error')
})

it('preserves the build-watch stop path and does not request EOF', async () => {
  const fixture = controlledProcess()
  const end = vi.spyOn(fixture.child.stdin, 'end')
  const requestWatchStop = vi.fn(async () => {
    fixture.child.exitCode = 1
    fixture.resolve({ code: 1, signal: null })
    fixture.child.stdout.end()
    fixture.child.stderr.end()
  })
  await stopConsumerProcess({ ...fixture, operation: 'build-watch', toolchain: 'vite', requestWatchStop })
  expect(requestWatchStop).toHaveBeenCalledWith(fixture.child, 'vite')
  expect(end).not.toHaveBeenCalled()
})

it('uses explicit native watch control and waits for exit plus both final output streams', async () => {
  const fixture = controlledProcess()
  const requestShutdown = vi.fn(async () => undefined)
  const disposeShutdown = vi.fn(async () => undefined)
  const requestWatchStop = vi.fn()
  const end = vi.spyOn(fixture.child.stdin, 'end')
  let stopped = false
  const stopping = stopConsumerProcess({ ...fixture, operation: 'build-watch', toolchain: 'vite-plus', requestShutdown, disposeShutdown, requestWatchStop })
    .then(() => stopped = true)
  await setImmediate()
  expect(requestShutdown).toHaveBeenCalledOnce()
  expect(requestWatchStop).not.toHaveBeenCalled()
  expect(end).not.toHaveBeenCalled()
  expect(stopped).toBe(false)
  fixture.child.exitCode = 0
  fixture.resolve({ code: 0, signal: null })
  fixture.child.stdout.end('late native stdout')
  await setImmediate()
  expect(stopped).toBe(false)
  expect(disposeShutdown).not.toHaveBeenCalled()
  fixture.child.stderr.end('late native stderr')
  await stopping
  expect(fixture.output()).toEqual({ stdout: 'late native stdout', stderr: 'late native stderr' })
  expect(disposeShutdown).toHaveBeenCalledOnce()
})

it('requires a zero native watch exit even when host-control acknowledges success', async () => {
  const fixture = controlledProcess()
  const requestShutdown = vi.fn(async () => {
    fixture.child.exitCode = 1
    fixture.resolve({ code: 1, signal: null })
    fixture.child.stdout.end()
    fixture.child.stderr.end('native watch cleanup failure')
  })
  await expect(stopConsumerProcess({ ...fixture, operation: 'build-watch', toolchain: 'vite', requestShutdown }))
    .rejects
    .toMatchObject({ cause: { message: expect.stringContaining('finish successfully') } })
  expect(fixture.output().stderr).toBe('native watch cleanup failure')
})

it.each(['missing', 'late-rejection'])('rejects a zero native exit with a %s cleanup receipt', async (outcome) => {
  const fixture = controlledProcess()
  const receipt = Promise.withResolvers<void>()
  const original = new Error('late consumer cleanup receipt failed')
  const requestShutdown = vi.fn(() => receipt.promise)
  fixture.child.exitCode = 0
  fixture.resolve({ code: 0, signal: null })
  fixture.child.stdout.end('completed output')
  fixture.child.stderr.end()
  const stopping = stopConsumerProcess({ ...fixture, operation: 'build-watch', toolchain: 'vite', requestShutdown, timeoutMs: 100 })
  const result = stopping.catch(error => error)
  await setImmediate()
  if (outcome === 'late-rejection') {
    receipt.reject(original)
  }
  const failure: unknown = await result
  expect(failure).toBeInstanceOf(AggregateError)
  expect(failure).toMatchObject({
    cause: outcome === 'late-rejection' ? original : expect.objectContaining({ message: 'Consumer process exit or output drain timed out' }),
  })
})

it('reports a failed consumer startup without waiting for a missing native receipt', async () => {
  const fixture = controlledProcess()
  fixture.child.exitCode = 1
  fixture.resolve({ code: 1, signal: null })
  fixture.child.stdout.end()
  fixture.child.stderr.end('startup failed before control connected')
  const requestShutdown = vi.fn(() => new Promise<void>(() => {}))
  await expect(stopConsumerProcess({ ...fixture, operation: 'dev', toolchain: 'vite', requestShutdown, timeoutMs: 100 }))
    .rejects
    .toMatchObject({ cause: { message: expect.stringContaining('finish successfully') } })
})

it('requests token-owned leaf shutdown after its parent CLI has already exited', async () => {
  const fixture = controlledProcess()
  fixture.child.exitCode = 0
  fixture.resolve({ code: 0, signal: null })
  const requestShutdown = vi.fn(async () => {
    fixture.child.stdout.end('remaining native leaf output')
    fixture.child.stderr.end('remaining native leaf diagnostic')
  })
  const disposeShutdown = vi.fn(async () => undefined)
  await stopConsumerProcess({ ...fixture, operation: 'dev', toolchain: 'vite-plus', requestShutdown, disposeShutdown })
  expect(requestShutdown).toHaveBeenCalledOnce()
  expect(disposeShutdown).toHaveBeenCalledOnce()
  expect(fixture.output()).toEqual({ stdout: 'remaining native leaf output', stderr: 'remaining native leaf diagnostic' })
})

it('preserves the host-control error and a separate disposal failure after forced cleanup', async () => {
  const fixture = controlledProcess()
  const original = new Error('native closeWatcher failed')
  const disposal = new Error('control directory removal failed')
  const requestShutdown = vi.fn(async () => {
    throw original
  })
  const disposeShutdown = vi.fn(async () => {
    throw disposal
  })
  const forceCleanup = vi.fn(async () => {
    fixture.child.exitCode = 1
    fixture.resolve({ code: 1, signal: null })
    fixture.child.stdout.end()
    fixture.child.stderr.end('original native failure')
  })
  await expect(stopConsumerProcess({ ...fixture, operation: 'build-watch', toolchain: 'vite-plus', requestShutdown, disposeShutdown, forceCleanup }))
    .rejects
    .toMatchObject({
      errors: [expect.objectContaining({ cause: original }), disposal],
      cause: expect.objectContaining({ cause: original }),
    })
  expect(forceCleanup).toHaveBeenCalledOnce()
  expect(disposeShutdown).toHaveBeenCalledOnce()
})

it('rejects retained or changed private configuration without repairing it in the test', async () => {
  const root = await fixture()
  const original = await readConsumerPrivateConfig(root)
  expect(original).toBeNull()
  await writeFile(path.join(root, 'project.private.config.json'), '{"setting":{"compileHotReLoad":false}}')
  await expect(assertConsumerPrivateConfigRestored(root, original)).rejects.toThrow('restore the original')
  expect(await readFile(path.join(root, 'project.private.config.json'), 'utf8')).toContain('false')
  await rm(path.join(root, 'project.private.config.json'))
  await assertConsumerPrivateConfigRestored(root, original)
})
