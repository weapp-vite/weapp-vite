import type { VueTransformResult } from 'wevu/compiler'
import type { ModuleMeta } from '../src/plugin/types'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyScanState } from '../src/plugin/state'
import {
  compileWebVueSfc,
  ensureWebVueSfcResult,
  generateWebVueSfcStyle,
  generateWebVueSfcTemplate,
  resolveWebVueSfcStyleLanguage,
  transformWebVueSfcScript,
} from '../src/plugin/vueSfc'

async function writeFixtureFile(pathname: string, content: string) {
  await mkdir(dirname(pathname), { recursive: true })
  await writeFile(pathname, content)
}

function createMeta(kind: ModuleMeta['kind'], filename: string): ModuleMeta {
  return {
    kind,
    id: kind === 'app' ? 'app' : 'pages/index/index',
    scriptPath: filename,
    sourceType: 'vue-sfc',
  }
}

describe('web Vue SFC contracts', () => {
  it('transforms App and component factories with stable runtime metadata', async () => {
    const app = await transformWebVueSfcScript({
      code: 'const untouched = true; createApp({})',
      filename: '/src/app.vue',
      meta: createMeta('app', '/src/app.vue'),
      runtimeModuleId: 'virtual:runtime',
      styleLanguage: 'css',
      enableHmr: false,
    })
    expect(app.code).toContain('registerWebWevuApp({}, { id: "app", kind: "app" })')
    expect(app.code).not.toContain('weapp-web-sfc-template')
    expect(app.map).toBeTypeOf('object')

    const meta = {
      ...createMeta('page', '/src/pages/index.vue'),
      navigationBar: { title: 'Details' },
    }
    const component = await transformWebVueSfcScript({
      code: 'noop(); createWevuComponent({})',
      filename: '/src/pages/index.vue',
      meta,
      runtimeModuleId: 'virtual:runtime',
      styleLanguage: 'scss',
      enableHmr: true,
      hmrAcceptCode: 'acceptUpdate()',
    })
    expect(component.code).toContain('registerWebWevuComponent')
    expect(component.code).toContain('navigationBar: { "title": "Details" }')
    expect(component.code).toContain('weapp-web-sfc-template')
    expect(component.code).toContain('weapp-web-sfc-style&inline')
    expect(component.code).toContain('acceptUpdate()')

    await expect(transformWebVueSfcScript({
      code: 'export const missing = true',
      filename: '/src/missing.vue',
      meta: createMeta('component', '/src/missing.vue'),
      runtimeModuleId: 'virtual:runtime',
      styleLanguage: 'css',
      enableHmr: true,
    })).rejects.toThrow('createWevuComponent')
  })

  it('validates style languages and generates empty style fallbacks', () => {
    expect(resolveWebVueSfcStyleLanguage({} as VueTransformResult, '/src/plain.vue')).toBe('css')
    expect(resolveWebVueSfcStyleLanguage({
      meta: { styleBlocks: [{ lang: ' SCSS ' }] },
    } as VueTransformResult, '/src/scss.vue')).toBe('SCSS')
    expect(() => resolveWebVueSfcStyleLanguage({
      meta: { styleBlocks: [{ lang: '?bad' }] },
    } as VueTransformResult, '/src/invalid.vue')).toThrow('样式语言无效')
    expect(generateWebVueSfcStyle({} as VueTransformResult)).toBe('')
    expect(generateWebVueSfcStyle({ style: '.page {}' } as VueTransformResult)).toBe('.page {}')
  })

  it('generates templates with WXS and empty template fallbacks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-sfc-template-'))
    const filename = join(root, 'src/pages/index/index.vue')
    await writeFixtureFile(join(root, 'src/pages/index/tools.wxs'), 'module.exports = { ready: true }')
    const compiled = generateWebVueSfcTemplate({
      template: '<wxs module="tools" src="./tools.wxs" /><view>{{tools.ready}}</view>',
    } as VueTransformResult, createMeta('page', filename), filename, join(root, 'src'))
    expect(compiled.code).toContain('tools.wxs')

    const empty = generateWebVueSfcTemplate(
      {} as VueTransformResult,
      createMeta('component', '/src/components/empty.vue'),
      '/src/components/empty.vue',
      '/src',
    )
    expect(empty.code).toContain('export default render')
  })

  it('uses cached results and reads uncached SFC source from disk', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-sfc-cache-'))
    const filename = join(root, 'src/pages/index.vue')
    const source = '<template><view>disk</view></template>'
    await writeFixtureFile(filename, source)
    const state = createEmptyScanState()
    const meta = createMeta('page', filename)

    const compiled = await ensureWebVueSfcResult({ filename, meta, srcRoot: join(root, 'src'), state })
    expect(compiled.template).toContain('disk')
    expect(await ensureWebVueSfcResult({ filename, meta, srcRoot: join(root, 'src'), state })).toBe(compiled)
  })

  it('resolves alias, relative and root SFC src dependencies', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-sfc-src-'))
    const srcRoot = join(root, 'src')
    const filename = join(srcRoot, 'pages/index/index.vue')
    await writeFixtureFile(join(srcRoot, 'shared/alias.wxml'), '<view>alias</view>')
    await writeFixtureFile(join(srcRoot, 'pages/index/relative.wxml'), '<view>relative</view>')
    await writeFixtureFile(join(srcRoot, 'shared/root.wxml'), '<view>root</view>')

    for (const request of ['@/shared/alias.wxml', './relative.wxml', '/shared/root.wxml']) {
      const state = createEmptyScanState()
      const result = await compileWebVueSfc({
        source: `<template src="${request}"></template>`,
        filename,
        meta: createMeta('page', filename),
        srcRoot,
        state,
      })
      expect(result.template).toContain('<view>')
      expect(state.templatePathSet.size).toBe(1)
    }
  })

  it('handles unresolved local and bare auto-using component imports', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-sfc-auto-using-'))
    const srcRoot = join(root, 'src')
    const filename = join(srcRoot, 'pages/index.vue')
    const resolveId = vi.fn(async () => undefined)
    const result = await compileWebVueSfc({
      source: `
<script setup>
import MissingLocal from './missing.vue'
import MissingPackage from 'missing-package'
</script>
<template><missing-local /><missing-package /></template>
      `.trim(),
      filename,
      meta: createMeta('page', filename),
      srcRoot,
      state: createEmptyScanState(),
      resolveId,
    })
    expect(result.template).toContain('missing-local')
  })

  it('resolves alias, root and native auto-using component imports', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-sfc-auto-using-resolved-'))
    const srcRoot = join(root, 'src')
    const filename = join(srcRoot, 'pages/index.vue')
    await writeFixtureFile(join(srcRoot, 'components/alias.vue'), '<template><view>alias</view></template>')
    await writeFixtureFile(join(srcRoot, 'components/root.js'), 'Component({})')

    const result = await compileWebVueSfc({
      source: `
<script setup>
import AliasCard from '@/components/alias.vue'
import RootCard from '/components/root'
</script>
<template><alias-card /><root-card /></template>
      `.trim(),
      filename,
      meta: createMeta('page', filename),
      srcRoot,
      state: createEmptyScanState(),
    })

    expect(result.template).toContain('alias-card')
    expect(result.template).toContain('root-card')
  })
})
