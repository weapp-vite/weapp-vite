import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const source = await readFile(new URL('../packages/weapp-vite/scripts/verify-vite-host-consumer.mjs', import.meta.url), 'utf8')
const prefix = '[host-capability-probe] '
const consumerRoot = path.join(os.tmpdir(), 'host-capability-consumer')
const controllerDirectory = path.join(os.tmpdir(), 'host-capability-controller', 'packages/weapp-vite/scripts')
const functionSource = source.slice(source.indexOf('async function saveProbeDiagnostics('), source.indexOf('\nconst files ='))

function generatedProbe() {
  const start = source.indexOf('\'probe-host.mjs\': `') + '\'probe-host.mjs\': '.length
  const end = source.indexOf('\n  \'types.mts\':', start)
  return runInNewContext(source.slice(start, end).trim().replace(/,$/, ''), { plus: false, probeDiagnostics: true, probePrefix: prefix })
}

function commandContext(extra = {}) {
  return {
    assert,
    path,
    root: consumerRoot,
    controllerDirectory,
    probeDiagnostics: true,
    probePrefix: prefix,
    toolchain: 'wv',
    performance: { now: () => 100 },
    process: { version: 'test-node', platform: 'test-os', arch: 'test-arch', execPath: 'node', stdout: { write() {} }, stderr: { write() {} } },
    ...extra,
  }
}

describe('host capability diagnostic failure isolation', () => {
  it.each([false, true])('keeps original close and errors when phase output throws, close failure=%s', async (failClose) => {
    const originalError = new Error('original close failure')
    let closed = 0
    const code = generatedProbe().replace(/^import .*\n/gm, '').replaceAll('import.meta.url', '\'probe-host.mjs\'').replace(/const engine = await import\([^\n]+\)/, 'const engine = engineStub')
    const run = runInNewContext(`(async () => { ${code} })()`, {
      assert,
      createRequire: () => ({ resolve: value => value }),
      pathToFileURL: value => ({ href: value }),
      engineStub: { dev() {}, scan() {} },
      createServer: async () => ({
        environments: { client: { bundledDev: { getRolldownOptions() {}, storeOutputFiles() {}, listen() {} } } },
        close: async () => {
          closed++
          if (failClose) {
            throw originalError
          }
        },
      }),
      writeSync: () => { throw new Error('diagnostic output unavailable') },
      performance: { now: () => 100 },
      process: { once() {} },
      console: { log() {} },
      version: 'test-version',
    })
    if (failClose) {
      await expect(run).rejects.toBe(originalError)
    }
    else {
      await run
    }
    expect(closed).toBe(1)
  })

  it('retains complete safe phases before a truncated line without persisting extra fields', async () => {
    let recorded
    const save = runInNewContext(`(function () { ${functionSource.replaceAll('import.meta.dirname', 'controllerDirectory')} return saveProbeDiagnostics })()`, commandContext({
      mkdir: async () => {},
      writeFile: async (_file, value) => { recorded = JSON.parse(value) },
    }))
    await save(path.join(consumerRoot, 'probe-host.mjs'), 0, { stdout: [
      prefix + JSON.stringify({ phase: 'close-start', elapsedMs: 15, privateField: 'must-not-persist' }),
      `${prefix}{"phase":"close-complete",`,
    ].join('\n') }, { code: null, killed: true, signal: 'SIGKILL' })
    expect(recorded.phases).toEqual([{ phase: 'close-start', elapsedMs: 15 }])
    expect(recorded.invalidPhaseLines).toBe(1)
    expect(recorded).toMatchObject({ timeoutMs: 120_000, successfulNaturalExit: false, terminal: { code: null, killed: true, signal: 'SIGKILL' } })
    expect(JSON.stringify(recorded)).not.toContain('must-not-persist')
  })

  it.each([false, true])('preserves the command result when artifact saving fails, child failure=%s', async (failed) => {
    const originalError = Object.assign(new Error('original child failure'), { stdout: 'original output', stderr: 'original stderr' })
    const code = source.slice(source.indexOf('async function command('), source.indexOf('\nconst files ='))
    const command = runInNewContext(`(function () { ${code} return command })()`, commandContext({
      run: async () => {
        if (failed) {
          throw originalError
        }
        return { stdout: 'original output', stderr: '' }
      },
      saveProbeDiagnostics: async () => { throw new Error('artifact unavailable') },
    }))
    if (failed) {
      await expect(command('probe-host.mjs', [])).rejects.toBe(originalError)
    }
    else {
      await expect(command('probe-host.mjs', [])).resolves.toBeUndefined()
    }
  })
})
