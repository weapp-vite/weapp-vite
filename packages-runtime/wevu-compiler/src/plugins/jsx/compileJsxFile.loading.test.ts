import path from 'node:path'
import { expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  loaded: vi.fn(),
  transformed: vi.fn(),
  failure: undefined as Error | undefined,
}))

vi.mock('./vueJsxTransform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./vueJsxTransform')>()
  state.loaded()
  return {
    ...actual,
    transformVueJsxScript(...args: Parameters<typeof actual.transformVueJsxScript>) {
      state.transformed(...args)
      if (state.failure) {
        const error = state.failure
        state.failure = undefined
        throw error
      }
      return actual.transformVueJsxScript(...args)
    },
  }
})

it('loads the JSX transform only for JSX compilation and preserves conversion failures', async () => {
  const { compileJsxFile, compileVueFile } = await import('../../index')
  const filename = path.resolve('src/pages/loading.vue')
  expect(state.loaded).not.toHaveBeenCalled()

  const plain = await compileVueFile(
    '<script setup lang="ts">const title: string = "plain"</script><template><view>{{ title }}</view></template>',
    filename,
  )
  expect(plain.template).toContain('<view>')
  expect(state.loaded).not.toHaveBeenCalled()

  const source = '<script lang="tsx">export const shared = <view>shared</view>; export default {}</script><template><view /></template>'
  const failure = new Error('JSX conversion failed')
  state.failure = failure
  await expect(compileVueFile(source, filename)).rejects.toBe(failure)
  expect(state.loaded).toHaveBeenCalledTimes(1)

  const sfc = await compileVueFile(source, filename)
  expect(sfc.script).toContain('createVNode')
  expect(sfc.script).not.toContain('<view>')

  const jsx = await compileJsxFile(
    'export const shared = <view>file</view>',
    path.resolve('src/shared.tsx'),
  )
  expect(jsx.script).toContain('createVNode')
  expect(jsx.script).not.toContain('<view>')
  expect(state.loaded).toHaveBeenCalledTimes(1)
  expect(state.transformed).toHaveBeenCalledTimes(3)
})
