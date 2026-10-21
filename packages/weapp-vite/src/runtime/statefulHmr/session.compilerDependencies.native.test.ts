import { readFile, writeFile } from 'node:fs/promises'
import path from 'pathe'
import { expect, it } from 'vitest'
import { withNativeCompilerFixture } from '../../../test/fixtures/compilerDependencies/native'

// 观察未执行客户端的真实 Noop 交付，不注入 batch、Vite event 或 provider prepare。
it.each(['token-only', 'label-only', 'mixed', 'vite-only'] as const)('delivers compiler dependencies from real no-client updates: %s', async (kind) => {
  await withNativeCompilerFixture(kind, async (fixture) => {
    const { host, token, label, outDir, styleFile, prepare, trace } = fixture
    await fixture.ready()
    expect(host.ownsDependency(token)).toBe(true)
    expect(host.isNativeSource(label)).toBe(true)
    expect(prepare).not.toHaveBeenCalled()
    trace.begin()
    trace.record('mutation.enter', { kind })
    if (kind !== 'label-only') {
      await writeFile(token, JSON.stringify({ color: 'blue' }))
    }
    if (kind === 'label-only' || kind === 'mixed') {
      await writeFile(label, 'export const label = "initial"; // comment-only edit\n')
    }
    trace.record('mutation.completed', { kind })

    if (kind === 'label-only' || kind === 'mixed') {
      // 必须观察 label；token 先交付时不能把尚未到来的文件事件视为已结算。
      await fixture.waitFor(() => trace.hasNativeFile(label))
    }
    if (kind !== 'label-only') {
      await fixture.waitFor(() => kind === 'vite-only' ? trace.hasDependencyChange(token) : trace.hasNativeFile(token))
      await fixture.waitFor(() => trace.hasCommittedStyle(styleFile))
    }
    // 非 Noop 会在测试控制流明确失败；本 fixture 不伪造客户端执行或 ACK。
    await fixture.settle()
    trace.assertSupported()
    if (kind === 'label-only') {
      expect(prepare).not.toHaveBeenCalled()
    }
    else {
      expect(prepare).toHaveBeenCalled()
      expect(prepare.mock.calls.every(([input]) => fixture.color(input.sources) === 'blue')).toBe(true)
      expect(await readFile(path.join(outDir, styleFile), 'utf8')).toBe('.probe { color: blue; }')
    }
  })
}, 120_000)
