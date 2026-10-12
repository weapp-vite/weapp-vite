import os from 'node:os'
import path from 'node:path'
import { fs } from '@weapp-core/shared/fs'
import { expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  loaded: vi.fn(),
  failure: undefined as Error | undefined,
}))

vi.mock('../wxs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../wxs')>()
  state.loaded()
  return {
    ...actual,
    transformWxsCode(...args: Parameters<typeof actual.transformWxsCode>) {
      if (state.failure) {
        const error = state.failure
        state.failure = undefined
        throw error
      }
      return actual.transformWxsCode(...args)
    },
  }
})

it('loads the WXS transform after a readable dependency is found and retries failed conversion', async () => {
  const { wxs } = await import('./wxs')
  expect(state.loaded).not.toHaveBeenCalled()
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wxs-loading-'))
  try {
    const tokenMap = new Map<string, any>()
    const plugin = wxs({
      configService: {
        absoluteSrcRoot: root,
        platform: 'weapp',
        outputExtensions: { wxml: 'wxml', wxs: 'wxs' },
        relativeOutputPath(filePath: string) {
          return path.relative(root, filePath).replace(/\\/g, '/')
        },
      },
      wxmlService: { tokenMap },
    } as any)[0]!
    const emitFile = vi.fn()
    const generate = () => plugin.generateBundle!.call({ emitFile } as any, {}, {})

    await generate()
    expect(state.loaded).not.toHaveBeenCalled()
    tokenMap.set(path.join(root, 'index.wxml'), {
      deps: [{ tagName: 'wxs', value: './main.wxs', attrs: { src: './main.wxs' } }],
    })
    await generate()
    expect(state.loaded).not.toHaveBeenCalled()

    await fs.writeFile(path.join(root, 'main.wxs'), 'module.exports = { value: require("./helper.wxs").value }')
    await fs.writeFile(path.join(root, 'helper.wxs'), 'module.exports = { value: 42 }')
    const failure = new Error('WXS conversion failed')
    state.failure = failure
    await expect(generate()).rejects.toBe(failure)
    expect(emitFile).not.toHaveBeenCalled()

    await generate()
    expect(emitFile.mock.calls.map(([asset]) => asset.fileName).sort()).toEqual(['helper.wxs', 'main.wxs'])
    expect(state.loaded).toHaveBeenCalledTimes(1)
  }
  finally {
    await fs.remove(root)
  }
})
