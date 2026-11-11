import type { MutableCompilerContext } from '../../../context'
import { expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../runtimeState'
import { createWxmlScanner } from './scan'
import { createWxmlServiceState } from './shared'

it.each(['html', 'wxml'])('leaves declared SFC external %s blocks to their compiler across all watcher callers', async (extension) => {
  const runtimeState = createRuntimeState()
  const ctx = { runtimeState, configService: { platform: 'weapp', weappViteConfig: {} } } as MutableCompilerContext
  const setTokenDeps = vi.fn()
  const state = createWxmlServiceState(ctx)
  const scanner = createWxmlScanner(state, { setTokenDeps })
  const external = `src/pages/view.${extension}`
  runtimeState.build.hmr.vueEntryStyleBindings.set('src/pages/index.vue', { sources: [external], expressions: [] })
  // 无需按扩展名读盘，避免合法 Vue void 元素污染原生 token/cache 或 cleanup 错误队列。
  await expect(scanner.scan(external)).resolves.toBeUndefined()
  expect(state.tokenMap.has(external)).toBe(false)
  expect(setTokenDeps).not.toHaveBeenCalled()
  // 最终产物和原生来源仍保留 XML 严格校验。
  expect(() => scanner.analyze('<view><input v-model="value"></view>')).toThrow('[weapp.wxml]')
})
