import type { MutableCompilerContext } from '../../../context'
import { tmpdir } from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
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

it('clears a template that disappears between stat and open and scans it again when restored', async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'weapp-wxml-read-race-'))
  const file = path.join(root, 'page.wxml')
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: { platform: 'weapp', weappViteConfig: {}, relativeCwd: (file: string) => path.relative(root, file) },
  } as MutableCompilerContext
  const state = createWxmlServiceState(ctx)
  const setTokenDeps = vi.fn<() => Promise<void>>()
  const scanner = createWxmlScanner(state, { setTokenDeps })
  try {
    await fs.writeFile(file, '<view/>')
    expect(await scanner.scan(file)).toBeDefined()
    expect(state.tokenMap.has(file)).toBe(true)
    await fs.writeFile(file, '<view>longer before removal</view>')

    const readFile = fs.readFile.bind(fs)
    const read = vi.spyOn(fs, 'readFile').mockImplementationOnce(async (openedFile) => {
      expect(openedFile).toBe(file)
      await fs.remove(file)
      return readFile(file, 'utf8')
    })
    try {
      await expect(scanner.scan(file)).resolves.toBeUndefined()
      expect(read).toHaveBeenCalledOnce()
    }
    finally {
      read.mockRestore()
    }
    expect(state.tokenMap.has(file)).toBe(false)
    expect(state.cache.get(file)).toBeUndefined()
    expect(setTokenDeps).toHaveBeenLastCalledWith(file, [])

    await fs.writeFile(file, '<view>restored</view>')
    expect(await scanner.scan(file)).toBeDefined()
    expect(state.tokenMap.has(file)).toBe(true)
  }
  finally {
    await fs.remove(root)
  }
})
