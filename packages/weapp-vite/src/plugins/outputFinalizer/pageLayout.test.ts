import type { OutputBundle } from 'rolldown'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { registerNativePageLayoutOutput, restoreNativePageLayoutOutputs } from './pageLayout'

function createContext() {
  const srcRoot = '/project/src'
  return {
    configService: {
      outputExtensions: {
        wxml: 'wxml',
        wxs: 'wxs',
      },
      platform: 'weapp',
      relativeOutputPath(filePath: string) {
        return path.relative(srcRoot, filePath).replaceAll('\\', '/')
      },
    },
    runtimeState: {},
  } as any
}

describe('native page layout output finalizer', () => {
  it('restores layout branches after a late plugin replaces the page template', () => {
    const ctx = createContext()
    const pageId = '/project/src/pages/layouts/index.ts'
    const templatePath = '/project/src/pages/layouts/index.wxml'
    registerNativePageLayoutOutput({
      configService: ctx.configService,
      runtimeState: ctx.runtimeState,
      pageId,
      templatePath,
      plan: {
        dynamicSwitch: true,
        currentLayout: {
          file: '/project/src/layouts/default/index.ts',
          importPath: '/layouts/default/index',
          kind: 'native',
          layoutName: 'default',
          tagName: 'weapp-layout-default',
        },
        layouts: [
          {
            file: '/project/src/layouts/default/index.ts',
            importPath: '/layouts/default/index',
            kind: 'native',
            layoutName: 'default',
            tagName: 'weapp-layout-default',
          },
          {
            file: '/project/src/layouts/admin/index.ts',
            importPath: '/layouts/admin/index',
            kind: 'native',
            layoutName: 'admin',
            tagName: 'weapp-layout-admin',
          },
        ],
        dynamicPropKeys: ['title'],
      },
    })
    const bundle = {
      'pages/layouts/index.wxml': {
        type: 'asset',
        fileName: 'pages/layouts/index.wxml',
        source: '<view class="tracking-_b0_d2em_B">content</view>',
      },
    } as unknown as OutputBundle

    restoreNativePageLayoutOutputs(ctx, bundle)
    restoreNativePageLayoutOutputs(ctx, bundle)

    const source = String((bundle['pages/layouts/index.wxml'] as any).source)
    expect(source).toContain(`__wv_page_layout_name === 'admin'`)
    expect(source).toContain(`!__wv_page_layout_name || __wv_page_layout_name === 'default'`)
    expect(source).toContain('tracking-_b0_d2em_B')
    expect(source.match(/<weapp-layout-admin/g)).toHaveLength(1)
    expect(source.match(/<weapp-layout-default/g)).toHaveLength(1)
  })
})
