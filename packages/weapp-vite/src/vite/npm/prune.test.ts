import type { OutputBundle } from 'rolldown'
import type { PreparedNpmOutput } from './output'
import { describe, expect, it } from 'vitest'
import { pruneNpmOutput } from './prune'

function createOutput(files: Record<string, string>): PreparedNpmOutput {
  return {
    assets: Object.entries(files).map(([fileName, source]) => ({ type: 'asset', fileName, source })),
    external: new Map(),
    watchFiles: [],
  }
}

function createBundle(files: Record<string, string>): OutputBundle {
  return Object.fromEntries(Object.entries(files).map(([fileName, source]) => [fileName, {
    type: 'asset',
    fileName,
    source,
  }])) as OutputBundle
}

function outputNames(output: PreparedNpmOutput) {
  return output.assets.map(asset => asset.fileName).filter((fileName): fileName is string => Boolean(fileName)).sort()
}

describe('npm output pruning', () => {
  it('follows component, JavaScript, template, style, and static asset references', () => {
    const output = createOutput({
      'miniprogram_npm/ui/button/button.js': 'import "./helper.js"; export const icon = require("./runtime.json"); import("./lazy.js"); const image = "../assets/check.png"',
      'miniprogram_npm/ui/button/button.json': JSON.stringify({ usingComponents: { 't-icon': '../icon/icon' } }),
      'miniprogram_npm/ui/button/button.wxml': '<include src="../common/templates/button.wxml"/><wxs src="./format.wxs" module="format"/>',
      'miniprogram_npm/ui/button/button.wxss': '@import "../common/style/index.wxss"; .button { background: url("../assets/check.png") }',
      'miniprogram_npm/ui/button/helper.js': 'export const helper = true',
      'miniprogram_npm/ui/button/lazy.js': 'export const lazy = true',
      'miniprogram_npm/ui/button/runtime.json': '{}',
      'miniprogram_npm/ui/button/format.wxs': 'module.exports = {}',
      'miniprogram_npm/ui/icon/icon.js': 'Component({})',
      'miniprogram_npm/ui/icon/icon.json': '{}',
      'miniprogram_npm/ui/common/templates/button.wxml': '<view />',
      'miniprogram_npm/ui/common/style/index.wxss': '.button { color: red }',
      'miniprogram_npm/ui/assets/check.png': 'image',
      'miniprogram_npm/ui/dialog/dialog.js': 'Component({})',
      'miniprogram_npm/ui/dialog/dialog.d.ts': 'export declare const dialog: unknown',
      'miniprogram_npm/ui/package.json': '{}',
    })
    const bundle = createBundle({
      'app.json': JSON.stringify({ pages: ['pages/index'] }),
      'pages/index.json': JSON.stringify({ usingComponents: { 't-button': '../miniprogram_npm/ui/button/button' } }),
    })

    pruneNpmOutput(output, bundle, { enabled: true })

    expect(outputNames(output)).toEqual([
      'miniprogram_npm/ui/assets/check.png',
      'miniprogram_npm/ui/button/button.js',
      'miniprogram_npm/ui/button/button.json',
      'miniprogram_npm/ui/button/button.wxml',
      'miniprogram_npm/ui/button/button.wxss',
      'miniprogram_npm/ui/button/format.wxs',
      'miniprogram_npm/ui/button/helper.js',
      'miniprogram_npm/ui/button/lazy.js',
      'miniprogram_npm/ui/button/runtime.json',
      'miniprogram_npm/ui/common/style/index.wxss',
      'miniprogram_npm/ui/common/templates/button.wxml',
      'miniprogram_npm/ui/icon/icon.js',
      'miniprogram_npm/ui/icon/icon.json',
      'miniprogram_npm/ui/package.json',
    ])
  })

  it('resolves extensionless module names that contain dots', () => {
    const output = createOutput({
      'miniprogram_npm/ui/button/index.js': 'require("./message.interface")',
      'miniprogram_npm/ui/button/message.interface.js': 'module.exports = {}',
      'miniprogram_npm/ui/button/unused.js': 'export const unused = true',
      'miniprogram_npm/ui/package.json': '{}',
    })
    const bundle = createBundle({
      'pages/index.json': JSON.stringify({ usingComponents: { button: 'ui/button' } }),
    })

    pruneNpmOutput(output, bundle, { enabled: true })

    expect(outputNames(output)).toEqual([
      'miniprogram_npm/ui/button/index.js',
      'miniprogram_npm/ui/button/message.interface.js',
      'miniprogram_npm/ui/package.json',
    ])
  })

  it('ignores extensionless component relation paths in JavaScript', () => {
    const output = createOutput({
      'miniprogram_npm/ui/swiper/swiper.js': 'this.getRelationNodes("./swiper-nav")',
      'miniprogram_npm/ui/swiper/unused.js': 'export const unused = true',
      'miniprogram_npm/ui/package.json': '{}',
    })
    const bundle = createBundle({
      'pages/index.json': JSON.stringify({ usingComponents: { swiper: 'ui/swiper/swiper' } }),
    })

    pruneNpmOutput(output, bundle, { enabled: true })

    expect(outputNames(output)).toEqual([
      'miniprogram_npm/ui/package.json',
      'miniprogram_npm/ui/swiper/swiper.js',
    ])
  })

  it('keeps a dynamically loaded nested package without retaining unrelated packages', () => {
    const output = createOutput({
      'miniprogram_npm/ui/index.js': 'require("./node_modules/shared/index.js")',
      'miniprogram_npm/ui/node_modules/shared/index.js': 'require(getRuntimePath())',
      'miniprogram_npm/ui/node_modules/shared/runtime.js': 'export const runtime = true',
      'miniprogram_npm/ui/node_modules/shared/package.json': '{}',
      'miniprogram_npm/ui/package.json': '{}',
      'miniprogram_npm/unused/index.js': 'export const unused = true',
      'miniprogram_npm/unused/package.json': '{}',
    })
    const bundle = createBundle({
      'pages/index.json': JSON.stringify({ usingComponents: { ui: '../miniprogram_npm/ui' } }),
    })

    pruneNpmOutput(output, bundle, { enabled: true })

    expect(outputNames(output)).toEqual([
      'miniprogram_npm/ui/index.js',
      'miniprogram_npm/ui/node_modules/shared/index.js',
      'miniprogram_npm/ui/node_modules/shared/package.json',
      'miniprogram_npm/ui/node_modules/shared/runtime.js',
      'miniprogram_npm/ui/package.json',
    ])
  })

  it('does not treat declarations and sourcemaps as runtime dependencies', () => {
    const output = createOutput({
      'miniprogram_npm/ui/button/index.js': 'Component({})',
      'miniprogram_npm/ui/button/index.d.ts': 'export type Component = import("./runtime-types").Component',
      'miniprogram_npm/ui/button/index.js.map': '{"sources":["./unused.js"]}',
      'miniprogram_npm/ui/button/unused.js': 'export const unused = true',
      'miniprogram_npm/ui/package.json': '{}',
    })
    const bundle = createBundle({
      'pages/index.json': JSON.stringify({ usingComponents: { button: 'ui/button' } }),
    })

    pruneNpmOutput(output, bundle, { enabled: true })

    expect(outputNames(output)).toEqual([
      'miniprogram_npm/ui/button/index.js',
      'miniprogram_npm/ui/package.json',
    ])
  })

  it('falls back to the whole referenced package for dynamic module loading', () => {
    const output = createOutput({
      'miniprogram_npm/ui/button/index.js': 'import "./loader.js"; Component({})',
      'miniprogram_npm/ui/button/loader.js': 'const path = getRuntimePath(); require(path)',
      'miniprogram_npm/ui/button/runtime.js': 'export const runtime = true',
      'miniprogram_npm/ui/button/unused.js': 'export const unused = true',
      'miniprogram_npm/ui/package.json': '{}',
      'miniprogram_npm/unused/index.js': 'Component({})',
    })
    const bundle = createBundle({
      'pages/index.json': JSON.stringify({ usingComponents: { button: 'ui/button' } }),
    })

    pruneNpmOutput(output, bundle, { enabled: true })

    expect(outputNames(output)).toEqual([
      'miniprogram_npm/ui/button/index.js',
      'miniprogram_npm/ui/button/loader.js',
      'miniprogram_npm/ui/button/runtime.js',
      'miniprogram_npm/ui/button/unused.js',
      'miniprogram_npm/ui/package.json',
    ])
  })

  it('falls back to a package when a static local reference cannot be resolved', () => {
    const output = createOutput({
      'miniprogram_npm/ui/button/index.js': 'import "./missing-runtime.js"; Component({})',
      'miniprogram_npm/ui/button/runtime.js': 'export const runtime = true',
      'miniprogram_npm/ui/button/unused.js': 'export const unused = true',
      'miniprogram_npm/ui/package.json': '{}',
    })
    const bundle = createBundle({
      'pages/index.json': JSON.stringify({ usingComponents: { button: 'ui/button' } }),
    })

    pruneNpmOutput(output, bundle, { enabled: true })

    expect(outputNames(output)).toEqual([
      'miniprogram_npm/ui/button/index.js',
      'miniprogram_npm/ui/button/runtime.js',
      'miniprogram_npm/ui/button/unused.js',
      'miniprogram_npm/ui/package.json',
    ])
  })

  it('does not treat a dynamic data-src attribute as a template loader', () => {
    const output = createOutput({
      'miniprogram_npm/ui/button/index.js': 'Component({})',
      'miniprogram_npm/ui/button/index.wxml': '<view data-src="{{imageUrl}}" />',
      'miniprogram_npm/ui/button/unused.js': 'export const unused = true',
    })
    const bundle = createBundle({
      'pages/index.json': JSON.stringify({ usingComponents: { button: 'ui/button' } }),
    })

    pruneNpmOutput(output, bundle, { enabled: true })

    expect(outputNames(output)).toEqual([
      'miniprogram_npm/ui/button/index.js',
      'miniprogram_npm/ui/button/index.wxml',
    ])
  })

  it('keeps main, regular subpackage, and independent subpackage references in separate npm roots', () => {
    const output = createOutput({
      'miniprogram_npm/ui/button/index.js': 'Component({})',
      'subpackages/normal/miniprogram_npm/ui/dialog/index.js': 'Component({})',
      'subpackages/independent/miniprogram_npm/ui/toast/index.js': 'Component({})',
    })
    const bundle = createBundle({
      'pages/index.json': JSON.stringify({ usingComponents: { button: '../miniprogram_npm/ui/button' } }),
      'subpackages/normal/index.json': JSON.stringify({ usingComponents: { dialog: 'ui/dialog' } }),
      'subpackages/independent/index.json': JSON.stringify({ usingComponents: { toast: 'ui/toast' } }),
    })

    pruneNpmOutput(output, bundle, { enabled: true })

    expect(outputNames(output)).toEqual([
      'miniprogram_npm/ui/button/index.js',
      'subpackages/independent/miniprogram_npm/ui/toast/index.js',
      'subpackages/normal/miniprogram_npm/ui/dialog/index.js',
    ])
  })

  it('keeps dynamic bundle references within their main, subpackage, and plugin npm boundaries', () => {
    const output = createOutput({
      'miniprogram_npm/ui/main-used.js': 'Component({})',
      'miniprogram_npm/ui/main-unused.js': 'Component({})',
      'subpackages/normal/miniprogram_npm/ui/dialog/index.js': 'Component({})',
      'subpackages/normal/miniprogram_npm/ui/toast/index.js': 'Component({})',
      'plugin/miniprogram_npm/ui/plugin-used.js': 'Component({})',
      'plugin/miniprogram_npm/ui/plugin-unused.js': 'Component({})',
    })
    const bundle = createBundle({
      'app.js': 'const component = getComponentPath(); require(component)',
      'subpackages/normal/index.json': JSON.stringify({ usingComponents: { dialog: 'ui/dialog' } }),
      'plugin/app.json': JSON.stringify({ usingComponents: { plugin: 'ui/plugin-used' } }),
    })

    pruneNpmOutput(output, bundle, { enabled: true })

    expect(outputNames(output)).toEqual([
      'miniprogram_npm/ui/main-unused.js',
      'miniprogram_npm/ui/main-used.js',
      'plugin/miniprogram_npm/ui/plugin-used.js',
      'subpackages/normal/miniprogram_npm/ui/dialog/index.js',
    ])
  })

  it('preserves the referenced package on a dynamic template path without retaining empty packages', () => {
    const output = createOutput({
      'miniprogram_npm/ui/button/index.js': 'Component({})',
      'miniprogram_npm/ui/button/index.wxml': '<include src="{{templatePath}}"/>',
      'miniprogram_npm/ui/dialog/index.js': 'Component({})',
      'miniprogram_npm/ui/package.json': '{}',
      'miniprogram_npm/unused/index.js': 'Component({})',
      'miniprogram_npm/unused/package.json': '{}',
    })
    const bundle = createBundle({
      'pages/index.json': JSON.stringify({ usingComponents: { button: 'ui/button' } }),
    })

    pruneNpmOutput(output, bundle, { enabled: true })

    expect(outputNames(output)).toEqual([
      'miniprogram_npm/ui/button/index.js',
      'miniprogram_npm/ui/button/index.wxml',
      'miniprogram_npm/ui/dialog/index.js',
      'miniprogram_npm/ui/package.json',
    ])
  })

  it('prunes npm files published outside the host bundle using their logical target root', () => {
    const directory = '/external/npm-output'
    const output: PreparedNpmOutput = {
      assets: [],
      external: new Map([[directory, [
        { type: 'asset', fileName: 'ui/button/index.js', source: 'import "./helper.js"' },
        { type: 'asset', fileName: 'ui/button/helper.js', source: 'export const helper = true' },
        { type: 'asset', fileName: 'ui/dialog/index.js', source: 'Component({})' },
        { type: 'asset', fileName: 'ui/package.json', source: '{}' },
      ]]]),
      externalRoots: new Map([[directory, 'subpackages/normal/miniprogram_npm']]),
      watchFiles: [],
    }
    const bundle = createBundle({
      'subpackages/normal/index.json': JSON.stringify({ usingComponents: { button: 'ui/button' } }),
    })

    pruneNpmOutput(output, bundle, { enabled: true })

    expect(output.assets).toEqual([])
    expect(output.external.get(directory)?.map(asset => asset.fileName).sort()).toEqual([
      'ui/button/helper.js',
      'ui/button/index.js',
      'ui/package.json',
    ])
  })

  it('does nothing when disabled and preserves packages with explicit file rules', () => {
    const bundle = createBundle({})
    const disabled = createOutput({ 'miniprogram_npm/ui/unused.js': 'unused' })
    pruneNpmOutput(disabled, bundle, { enabled: false })
    expect(outputNames(disabled)).toEqual(['miniprogram_npm/ui/unused.js'])

    const configured = createOutput({
      'miniprogram_npm/ui/unused.js': 'unused',
      'miniprogram_npm/ui/package.json': '{}',
    })
    pruneNpmOutput(configured, bundle, { enabled: true, packageFiles: { ui: { include: ['unused.js'] } } })
    expect(outputNames(configured)).toEqual(['miniprogram_npm/ui/package.json', 'miniprogram_npm/ui/unused.js'])
  })
})
