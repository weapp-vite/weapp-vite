/* eslint-disable e18e/ban-dependencies -- 诊断生成器只启动所属 Node 单元测试进程，不运行构建或 E2E。 */
import type { NativeLoadMode } from './observation'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { afterEach, describe, expect, it } from 'vitest'
import { createNativeLoadDiagnostic } from './observation'

interface TraceRow {
  pid: number
  threadId: number
  seq: number
  elapsedMs: number
  kind: string
  mode: NativeLoadMode
  phase: string
  [key: string]: unknown
}

const roots: string[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await rm(root, { recursive: true, force: true })
  }
})

async function fixture(mode: NativeLoadMode, source = 'globalThis.nativeLoads = (globalThis.nativeLoads || 0) + 1; module.exports = { run: x => x + 1 };') {
  const root = await mkdtemp(path.join(tmpdir(), 'native-load-observer-'))
  roots.push(root)
  const nativePath = path.join(root, 'native.cjs')
  await writeFile(nativePath, source)
  const options = { mode, nativePath, directory: path.join(root, 'run') }
  return { ...await createNativeLoadDiagnostic(options), options }
}

async function rows(trace: string): Promise<TraceRow[]> {
  return (await readFile(trace, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as TraceRow)
}

async function run(setup: Awaited<ReturnType<typeof fixture>>, source: string, preload = true) {
  return execa(process.execPath, [...preload ? ['--require', setup.preload] : [], '-e', source], {
    env: { ...setup.environment, NODE_OPTIONS: '' },
    reject: false,
  })
}

function assertLifetime(events: TraceRow[], mode: NativeLoadMode) {
  expect(events[0]).toMatchObject({ kind: 'started', seq: 0, mode, nativeEnabled: mode !== 'off', bindingConfigured: true })
  expect(events.at(-1)).toMatchObject({ kind: 'finished', mode, exitCode: 0, invalidEvents: 0 })
  for (let index = 0; index < events.length; index++) {
    const event = events[index]!
    expect(event.seq).toBe(index)
    expect(event.elapsedMs).toBeGreaterThanOrEqual(events[index - 1]?.elapsedMs ?? 0)
    expect(event.pid).toBe(events[0]!.pid)
    expect(event.threadId).toBe(0)
  }
}

describe('native lazy loading diagnostic', () => {
  it.each(['off', 'on-no-load', 'load-only', 'actual'] as const)('does not load a binding when production module is merely imported (%s)', async (mode) => {
    const setup = await fixture(mode)
    const nativeSource = fileURLToPath(new URL('../../packages/ast/src/native.ts', import.meta.url))
    const child = await execa(process.execPath, ['--import', 'tsx', '--require', setup.preload, '--input-type=module', '-e', `await import(${JSON.stringify(nativeSource)});`], {
      env: { ...setup.environment, NODE_OPTIONS: '' },
      reject: false,
    })
    expect(child.exitCode, child.stderr).toBe(0)
    const events = await rows(setup.trace)
    // tsx 的 loader worker 不会继承 require；若未来改变，不能把线程行合并成主线程计数。
    expect(events.map(row => row.kind)).toEqual(['started', 'finished'])
    assertLifetime(events, mode)
  })

  it.each(['on-no-load', 'load-only', 'actual'] as const)('observes only the real first uncached request in %s mode', async (mode) => {
    const setup = await fixture(mode)
    const child = await run(setup, `
      const assert = require('node:assert/strict');
      const binding = require(process.env.WEAPP_VITE_NATIVE_AST_PATH);
      assert.equal(require(process.env.WEAPP_VITE_NATIVE_AST_PATH), binding);
      assert.equal(globalThis.nativeLoads || 0, ${mode === 'on-no-load' ? 0 : 1});
      ${mode === 'actual' ? 'assert.equal(binding.run(4), 5);' : 'assert.deepEqual(Object.keys(binding), []);'}
    `)
    expect(child.exitCode, child.stderr).toBe(0)
    const events = await rows(setup.trace)
    assertLifetime(events, mode)
    expect(events.filter(row => row.kind === 'binding-request')).toHaveLength(1)
    expect(events.filter(row => row.kind === 'load-success')).toHaveLength(mode === 'on-no-load' ? 0 : 1)
    expect(events.filter(row => row.kind === 'binding-call')).toHaveLength(mode === 'actual' ? 1 : 0)
    if (mode !== 'on-no-load') {
      expect(events.find(row => row.kind === 'load-success')).toMatchObject({ durationMs: expect.any(Number), nodeModulesAdded: 0 })
    }
    expect(await readFile(setup.trace, 'utf8')).not.toContain(setup.options.nativePath)
  })

  it('preserves receivers, getters, frozen exports, return identity and thrown values', async () => {
    const setup = await fixture('actual', `'use strict';
      const state = { value: 1, reads: 0 };
      const output = { featureFlags: ['example'] };
      module.exports = Object.freeze({
        get value() { state.reads++; return state.value; },
        get reads() { return state.reads; },
        update() { if (this !== module.exports) throw Error('wrong receiver'); state.value++; return output; },
        detached() { return this; },
        empty() {},
        failure() { throw output; },
        output,
      });
    `)
    const child = await run(setup, `
      const assert = require('node:assert/strict');
      const binding = require(process.env.WEAPP_VITE_NATIVE_AST_PATH);
      assert.equal(binding.update, binding.update);
      assert.equal(binding.update(), binding.output);
      assert.equal(binding.value, 2);
      const detached = binding.detached;
      assert.equal(detached(), undefined);
      const receiver = {};
      assert.equal(detached.call(receiver), receiver);
      assert.equal(binding.empty(), undefined);
      try { binding.failure(); assert.fail(); } catch (error) { assert.equal(error, binding.output); }
      assert.ok(Object.keys(binding).includes('update'));
      assert.equal(binding.reads, 1);
    `)
    expect(child.exitCode, child.stderr).toBe(0)
    const events = await rows(setup.trace)
    assertLifetime(events, 'actual')
    expect(events.filter(row => row.kind === 'binding-call')).toHaveLength(5)
    expect(events.filter(row => row.kind === 'binding-return' && row.nullish)).toHaveLength(2)
    expect(events.filter(row => row.kind === 'binding-exception')).toHaveLength(1)
  })

  it('reports load exceptions and leaves the original exception intact', async () => {
    const setup = await fixture('load-only', 'throw new TypeError("fixture-load-failure");')
    const child = await run(setup, `
      const assert = require('node:assert/strict');
      assert.throws(() => require(process.env.WEAPP_VITE_NATIVE_AST_PATH), { name: 'TypeError', message: 'fixture-load-failure' });
    `)
    expect(child.exitCode, child.stderr).toBe(0)
    const events = await rows(setup.trace)
    assertLifetime(events, 'load-only')
    expect(events.map(row => row.kind)).toEqual(['started', 'binding-request', 'load-start', 'load-error', 'finished'])
    expect(events.find(row => row.kind === 'load-error')).toMatchObject({ durationMs: expect.any(Number), nodeModulesAdded: 0 })
    expect(await readFile(setup.trace, 'utf8')).not.toContain('fixture-load-failure')
  })

  it('records raw channel evidence, valid phases and malformed events without private payloads', async () => {
    const setup = await fixture('off')
    const child = await run(setup, `
      const { channel } = require('node:diagnostics_channel');
      const phase = channel('weapp-vite.ast.native-load-diagnostic.phase');
      const events = channel('weapp-vite.ast.native-analysis');
      phase.publish({ phase: 'import' });
      events.publish({ kind: 'call', batch: true, inputScripts: 3, inputBytes: 128 });
      for (const kind of ['cacheHits', 'fallbacks', 'loadFailures']) events.publish({ kind });
      phase.publish({ phase: 'recovery' });
      for (const bad of [null, {kind: 'call', batch: true, inputScripts: -1, inputBytes: 0}, {kind: 'private-data'}, {get kind() { throw Error('secret'); }}]) events.publish(bad);
      for (const phaseValue of ['', 'private/data', 'x'.repeat(65), 5]) phase.publish({ phase: phaseValue });
    `)
    expect(child.exitCode, child.stderr).toBe(0)
    const events = await rows(setup.trace)
    expect(events.filter(row => row.kind === 'phase').map(row => row.phase)).toEqual(['import', 'recovery'])
    expect(events.filter(row => row.origin === 'channel' && row.kind !== 'invalid-event').map(row => [row.kind, row.phase])).toEqual([
      ['call', 'import'],
      ['cacheHits', 'import'],
      ['fallbacks', 'import'],
      ['loadFailures', 'import'],
    ])
    expect(events.at(-1)).toMatchObject({ kind: 'finished', exitCode: 0, invalidEvents: 8, phase: 'recovery' })
    expect(events.filter(row => row.kind === 'invalid-event')).toHaveLength(8)
    expect(await readFile(setup.trace, 'utf8')).not.toMatch(/private|secret/)
  })

  it('keeps independently sequenced worker-thread lifetimes in the single owned process', async () => {
    const setup = await fixture('off')
    const child = await run(setup, `
      const { Worker } = require('node:worker_threads');
      new Worker('require("node:diagnostics_channel").channel("weapp-vite.ast.native-analysis").publish({kind:"fallbacks"})', { eval: true });
    `)
    expect(child.exitCode, child.stderr).toBe(0)
    const events = await rows(setup.trace)
    expect(new Set(events.map(row => row.pid)).size).toBe(1)
    const ids = [...new Set(events.map(row => row.threadId))]
    expect(ids).toHaveLength(2)
    for (const id of ids) {
      const thread = events.filter(row => row.threadId === id)
      expect(thread[0]).toMatchObject({ kind: 'started', seq: 0 })
      expect(thread.at(-1)).toMatchObject({ kind: 'finished', exitCode: 0 })
      expect(thread.map(row => row.seq)).toEqual(thread.map((_, index) => index))
    }
  })

  it('rejects missing preload, duplicate installation and later process reuse', async () => {
    const missing = await fixture('actual')
    const missingChild = await run(missing, 'require(process.env.WEAPP_VITE_NATIVE_AST_PATH)', false)
    expect(missingChild.exitCode).not.toBe(0)
    expect(missingChild.stderr).toContain('requires its matching preload')
    expect(await rows(missing.trace)).toEqual([])
    const duplicate = await fixture('actual')
    const child = await run(duplicate, `const file = require.resolve(${JSON.stringify(duplicate.preload)}); delete require.cache[file]; require(file);`)
    expect(child.exitCode).not.toBe(0)
    expect(child.stderr).toContain('already installed')
    expect((await rows(duplicate.trace)).at(-1)).toMatchObject({ kind: 'finished', exitCode: 1 })
    const before = await readFile(duplicate.trace, 'utf8')
    const reused = await run(duplicate, '')
    expect(reused.exitCode).not.toBe(0)
    expect(reused.stderr).toContain('already claimed')
    expect(await readFile(duplicate.trace, 'utf8')).toBe(before)
  })

  it('refuses an off-mode binding request and never overwrites an existing directory', async () => {
    const setup = await fixture('off')
    const child = await run(setup, 'require(process.env.WEAPP_VITE_NATIVE_AST_PATH)')
    expect(child.exitCode).not.toBe(0)
    expect(child.stderr).toContain('must not request a binding')
    expect((await rows(setup.trace)).map(row => row.kind)).toEqual(['started', 'binding-request', 'finished'])
    const before = await readFile(setup.preload, 'utf8')
    await expect(createNativeLoadDiagnostic(setup.options)).rejects.toThrow()
    expect(await readFile(setup.preload, 'utf8')).toBe(before)
    await expect(createNativeLoadDiagnostic({ ...setup.options, nativePath: path.dirname(setup.options.nativePath) })).rejects.toThrow('regular file')
    await expect(createNativeLoadDiagnostic({ ...setup.options, nativePath: 'relative.node' })).rejects.toThrow('absolute')
    await expect(createNativeLoadDiagnostic({ ...setup.options, mode: 'wrong' as NativeLoadMode })).rejects.toThrow('Unknown')
  })
})
