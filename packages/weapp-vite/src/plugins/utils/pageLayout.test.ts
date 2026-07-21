import { describe, expect, it, vi } from 'vitest'
import { expandResolvedPageLayoutFiles, registerResolvedPageLayoutDependencies } from './pageLayout'

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
      '/project/src/layouts/default/index.json',
      '/project/src/layouts/default/index.wxml',
      '/project/src/layouts/default/index.wxss',
      '/project/src/layouts/default/index.ts',
    ])
  })

  it('registers resolved layouts as logical entry dependencies', async () => {
    const replaceEntryDependencies = vi.fn()
    const sharedTemplate = '/project/src/shared/layout-card.wxml'
    const sharedWxs = '/project/src/shared/layout-helper.wxs'
    const scan = vi.fn(async () => {})

    await registerResolvedPageLayoutDependencies({
      moduleGraphService: {
        replaceEntryDependencies,
      },
      wxmlService: {
        depsMap: new Map([
          ['/project/src/layouts/default/index.wxml', new Set([sharedTemplate, sharedWxs])],
        ]),
        scan,
      },
    } as any, '/project/src/pages/home/index.vue', [
      {
        kind: 'native',
        file: '/project/src/layouts/default/index',
      },
    ] as any)

    expect(replaceEntryDependencies).toHaveBeenCalledWith(
      '/project/src/pages/home/index.vue',
      'layout',
      new Set([
        '/project/src/layouts/default/index.json',
        '/project/src/layouts/default/index.wxml',
        '/project/src/layouts/default/index.wxss',
        '/project/src/layouts/default/index.ts',
        sharedTemplate,
        sharedWxs,
      ]),
    )
    expect(scan).toHaveBeenCalledWith('/project/src/layouts/default/index.wxml')
  })
})
