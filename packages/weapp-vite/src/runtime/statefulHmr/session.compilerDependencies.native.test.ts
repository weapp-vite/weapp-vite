import { readFile, writeFile } from 'node:fs/promises'
import path from 'pathe'
import { expect, it } from 'vitest'
import { withNativeCompilerFixture } from '../../../test/fixtures/compilerDependencies/native'

// 观察未执行客户端的真实 Noop 交付，不注入 batch、Vite event 或 provider prepare。
it.each(['token-only', 'label-only', 'mixed', 'vite-only', 'same-style'] as const)('checks compiler output capabilities from real no-client updates: %s', async (kind) => {
  await withNativeCompilerFixture(kind, async (fixture) => {
    const { host, token, label, outDir, styleFile, prepare, trace, runtimeSession } = fixture
    await fixture.ready()
    expect(host.ownsDependency(token)).toBe(true)
    expect(host.isNativeSource(label)).toBe(true)
    expect(prepare).not.toHaveBeenCalled()
    const initialStyle = await readFile(path.join(outDir, styleFile), 'utf8')
    trace.begin()
    trace.record('mutation.enter', { kind })
    const sameStyle = kind === 'same-style' || kind === 'mixed'
    if (kind !== 'label-only') {
      await writeFile(token, JSON.stringify({ color: sameStyle ? 'red' : 'blue', revision: 1 }))
    }
    if (kind === 'label-only' || kind === 'mixed') {
      await writeFile(label, 'export const label = "initial"; // comment-only edit\n')
    }
    trace.record('mutation.completed', { kind })

    if (kind === 'label-only' || kind === 'mixed') {
      // 混合输入保持同字节样式，确保两个真实文件事件均被旧引擎观察后再结算。
      await fixture.waitFor(() => trace.hasNativeFile(label))
    }
    if (kind === 'label-only') {
      await fixture.settle()
      expect(prepare).not.toHaveBeenCalled()
      expect(runtimeSession.fallback).toBeUndefined()
    }
    else {
      await fixture.waitFor(() => kind === 'vite-only' ? trace.hasDependencyChange(token) : trace.hasNativeFile(token))
      await fixture.waitFor(() => prepare.mock.calls.length > 0)
      expect(prepare.mock.calls.every(([input]) => fixture.color(input.sources) === (sameStyle ? 'red' : 'blue'))).toBe(true)
      if (sameStyle) {
        await fixture.settle()
        expect(runtimeSession.fallback).toBeUndefined()
        expect(runtimeSession.phase).toBe('stateful')
      }
      else {
        await fixture.waitFor(() => runtimeSession.fallback !== undefined)
        expect(runtimeSession.fallback?.code).toBe('stylesheet-output')
        // 此 fixture 不绑定 classic 宿主：只能证明请求交接和拒绝旧写出，不能宣称完成 classic。
        expect(runtimeSession.phase).toBe('switching')
        expect(trace.hasCommittedStyle(styleFile)).toBe(false)
      }
    }
    trace.assertSupported()
    expect(await readFile(path.join(outDir, styleFile), 'utf8')).toBe(initialStyle)
  })
}, 120_000)
