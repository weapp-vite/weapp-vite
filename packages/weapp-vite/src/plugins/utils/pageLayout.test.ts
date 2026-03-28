import { describe, expect, it, vi } from 'vitest'
import { addResolvedPageLayoutWatchFiles, expandResolvedPageLayoutFiles } from './pageLayout'

const collectNativeLayoutAssetsMock = vi.hoisted(() => vi.fn(async () => ({
  json: '/project/src/layouts/default/index.json',
  template: '/project/src/layouts/default/index.wxml',
  style: '/project/src/layouts/default/index.wxss',
  script: '/project/src/layouts/default/index.ts',
})))

vi.mock('../vue/transform/pageLayout', () => ({
  collectNativeLayoutAssets: collectNativeLayoutAssetsMock,
}))

describe('page layout helpers', () => {
  it('expands resolved layout files with native sidecar assets', async () => {
    expect(await expandResolvedPageLayoutFiles([
      {
        kind: 'vue',
        file: '/project/src/layouts/dashboard.vue',
      },
      {
        kind: 'native',
        file: '/project/src/layouts/default/index',
      },
    ] as any)).toEqual([
      '/project/src/layouts/dashboard.vue',
      '/project/src/layouts/default/index',
      '/project/src/layouts/default/index.json',
      '/project/src/layouts/default/index.wxml',
      '/project/src/layouts/default/index.wxss',
      '/project/src/layouts/default/index.ts',
    ])
  })

  it('adds normalized watch files for resolved layouts', async () => {
    const addWatchFile = vi.fn()

    await addResolvedPageLayoutWatchFiles({
      addWatchFile,
    }, [
      {
        kind: 'native',
        file: '/project/src/layouts/default/index',
      },
    ] as any)

    expect(addWatchFile).toHaveBeenCalledTimes(5)
    expect(addWatchFile).toHaveBeenNthCalledWith(1, '/project/src/layouts/default/index')
    expect(addWatchFile).toHaveBeenNthCalledWith(5, '/project/src/layouts/default/index.ts')
  })
})
