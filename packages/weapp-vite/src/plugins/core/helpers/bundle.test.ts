import { describe, expect, it } from 'vitest'
import { filterPluginBundleOutputs, syncChunkImportsFromRequireCalls } from './bundle'

describe('core helper bundle', () => {
  it('keeps plugin assets intact in pluginOnly mode', () => {
    const bundle = {
      'index.js': {
        type: 'chunk',
        fileName: 'index.js',
        facadeModuleId: '/project/plugin/index.ts',
      },
      'plugin.json': {
        type: 'asset',
        fileName: 'plugin.json',
        source: '{}',
      },
      'pages/hello-page.wxml': {
        type: 'asset',
        fileName: 'pages/hello-page.wxml',
        source: '<view />',
      },
    } as any

    filterPluginBundleOutputs(bundle, {
      pluginOnly: true,
      absolutePluginOutputRoot: '/project/dist-plugin',
      absolutePluginRoot: '/project/plugin',
      outDir: '/project/dist-plugin',
    } as any)

    expect(Object.keys(bundle).sort()).toEqual([
      'index.js',
      'pages/hello-page.wxml',
      'plugin.json',
    ])
  })

  it('syncs relative require calls back into chunk imports', () => {
    const bundle = {
      'app.js': {
        type: 'chunk',
        fileName: 'app.js',
        code: [
          'require("./app.prelude.js")',
          'const runtime = require("./weapp-vendors/request-globals-runtime.js")',
          'const shared = require("./weapp-vendors/web-apis-shared.js")',
        ].join('\n'),
        imports: [],
      },
      'weapp-vendors/request-globals-runtime.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/request-globals-runtime.js',
        code: 'const shared = require("./web-apis-shared.js")',
        imports: [],
      },
      'app.prelude.js': {
        type: 'chunk',
        fileName: 'app.prelude.js',
        code: '',
        imports: [],
      },
      'weapp-vendors/web-apis-shared.js': {
        type: 'chunk',
        fileName: 'weapp-vendors/web-apis-shared.js',
        code: '',
        imports: [],
      },
    } as any

    syncChunkImportsFromRequireCalls(bundle)

    expect(bundle['app.js'].imports).toEqual([
      'app.prelude.js',
      'weapp-vendors/request-globals-runtime.js',
      'weapp-vendors/web-apis-shared.js',
    ])
    expect(bundle['weapp-vendors/request-globals-runtime.js'].imports).toEqual([
      'weapp-vendors/web-apis-shared.js',
    ])
  })
})
