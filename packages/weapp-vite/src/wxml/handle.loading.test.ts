import { expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  loaded: vi.fn(),
  transformed: vi.fn(),
  failure: undefined as Error | undefined,
}))

vi.mock('../wxs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../wxs')>()
  state.loaded()
  return {
    ...actual,
    transformWxsCode(...args: Parameters<typeof actual.transformWxsCode>) {
      state.transformed(...args)
      if (state.failure) {
        const error = state.failure
        state.failure = undefined
        throw error
      }
      return actual.transformWxsCode(...args)
    },
  }
})

it('loads inline WXS on demand, shares concurrent success and retries conversion failures', async () => {
  const { handleWxml } = await import('./handle')
  const { scanWxml } = await import('./scan')
  await handleWxml(scanWxml('<view>plain</view>'))
  await handleWxml(scanWxml('<wxs src="./helper.wxs" />'))
  expect(state.loaded).not.toHaveBeenCalled()

  const source = '<wxs module="shared" lang="ts">export const answer: number = 42</wxs><view>{{shared.answer}}</view>'
  // 首次顺序加载真实模块，避免 Vitest 的异步 manual mock 在并发 importOriginal 中被绕过。
  const initial = await handleWxml(scanWxml(source.replace('42', '41')))
  expect(initial.code).toContain('module.exports.answer')
  expect(initial.code).toContain('41')
  expect(state.loaded).toHaveBeenCalledTimes(1)
  expect(state.transformed).toHaveBeenCalledTimes(1)

  // 新源码尚未进入 inline 缓存，仍需在动态 import 等待后共享一次成功转换。
  const results = await Promise.all([
    handleWxml(scanWxml(source)),
    handleWxml(scanWxml(source)),
  ])
  expect(results[0]!.code).toBe(results[1]!.code)
  expect(results[0]!.code).toContain('module.exports.answer')
  expect(results[0]!.code).not.toContain(': number')
  expect(state.loaded).toHaveBeenCalledTimes(1)
  expect(state.transformed).toHaveBeenCalledTimes(2)

  const failure = new Error('inline WXS conversion failed')
  const retrySource = source.replace('42', '43')
  const retryToken = scanWxml(retrySource)
  state.failure = failure
  await expect(handleWxml(retryToken)).rejects.toBe(failure)
  const retried = await handleWxml(retryToken)
  expect(retried.code).toContain('43')
  expect(state.transformed).toHaveBeenCalledTimes(4)
}, 20_000)
