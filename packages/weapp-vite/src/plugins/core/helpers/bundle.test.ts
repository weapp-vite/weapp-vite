import { describe, expect, it } from 'vitest'
import { filterPluginBundleOutputs } from './bundle'

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
})
