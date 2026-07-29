import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { weappWebPlugin } from '../src/plugin'
import {
  AUTO_ROUTES_ID,
  ENTRY_ID,
  RESOLVED_AUTO_ROUTES_ID,
} from '../src/plugin/constants'
import { normalizePath } from '../src/plugin/path'

async function createPluginFixture() {
  const root = await mkdtemp(join(tmpdir(), 'weapp-web-hooks-'))
  const srcRoot = join(root, 'src')
  const pageDir = join(srcRoot, 'pages/index')
  const componentDir = join(srcRoot, 'components/card')
  const assetDir = join(srcRoot, 'assets')
  const layoutDir = join(srcRoot, 'layouts/default')
  await mkdir(pageDir, { recursive: true })
  await mkdir(componentDir, { recursive: true })
  await mkdir(assetDir, { recursive: true })
  await mkdir(layoutDir, { recursive: true })
  await writeFile(join(srcRoot, 'app.js'), 'App({})')
  await writeFile(join(srcRoot, 'app.json'), JSON.stringify({
    pages: ['pages/index/index'],
    usingComponents: { card: '/components/card/index' },
  }))
  await writeFile(join(pageDir, 'index.js'), 'Page({})')
  await writeFile(join(pageDir, 'index.json'), '{}')
  await writeFile(join(pageDir, 'index.wxml'), '<include src="./part.wxml" /><image src="../../assets/logo.png" /><view>page</view><page-meta />')
  await writeFile(join(pageDir, 'part.wxml'), '<view>part</view>')
  await writeFile(join(pageDir, 'index.wxss'), '.page { width: 750rpx; }')
  await writeFile(join(pageDir, 'logic.wxs'), 'var dep = require("./dep.wxs"); require("package-name"); module.exports = dep')
  await writeFile(join(pageDir, 'dep.wxs'), 'module.exports = { ready: true }')
  await writeFile(join(componentDir, 'index.js'), 'Component({})')
  await writeFile(join(componentDir, 'index.wxml'), '<camera /><view>card</view>')
  await writeFile(join(assetDir, 'logo.png'), new Uint8Array([1, 2, 3]))
  await writeFile(join(layoutDir, 'index.js'), 'Component({})')
  await writeFile(join(layoutDir, 'index.wxml'), '<view class="layout"><slot /></view>')
  await writeFile(join(srcRoot, 'standalone-part.wxml'), '<view>standalone part</view>')
  await writeFile(join(srcRoot, 'standalone.vue'), '<template><include src="./standalone-part.wxml" /><camera /><view>standalone</view></template>')
  return { componentDir, pageDir, root, srcRoot }
}

async function createSfcResolverFixture(template: string) {
  const root = await mkdtemp(join(tmpdir(), 'weapp-web-sfc-resolvers-'))
  const srcRoot = join(root, 'src')
  const pageDir = join(srcRoot, 'pages/index')
  await mkdir(pageDir, { recursive: true })
  await writeFile(join(srcRoot, 'app.vue'), '<script setup>defineAppJson({ pages: ["pages/index/index"] })</script>')
  await writeFile(join(pageDir, 'index.vue'), `<template>${template}</template>`)
  return { pageDir, root, srcRoot }
}

describe('weapp web plugin hook matrix', () => {
  it('merges CSS config and reports unsupported or duplicate PostCSS setup', () => {
    let plugin = weappWebPlugin()
    const warn = vi.fn()
    expect(plugin.config?.call({ warn }, { css: { postcss: './postcss.config.js' } })).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('无法注入 WXSS'))

    plugin = weappWebPlugin()
    expect(plugin.config?.call({}, {
      css: { postcss: { plugins: [{ postcssPlugin: 'weapp-vite-web-wxss' }] } },
    })).toBeUndefined()
    expect(plugin.config?.call({}, {})).toMatchObject({
      css: { postcss: { plugins: [expect.objectContaining({ postcssPlugin: 'weapp-vite-web-wxss' })] } },
    })
  })

  it('configures middleware, build resolver fallback and production asset emission', async () => {
    const { root } = await createPluginFixture()
    const plugin = weappWebPlugin({ srcDir: 'src' })
    await plugin.configResolved?.call({ warn: vi.fn() }, { root, command: 'build' } as any)

    const use = vi.fn()
    plugin.configureServer?.({ middlewares: { use } })
    expect(use).toHaveBeenCalledWith(expect.any(Function))

    const resolve = vi.fn(async (source: string) => source === 'known' ? { id: '/resolved/known.js' } : null)
    const emitFile = vi.fn()
    await plugin.buildStart?.call({ emitFile, resolve, warn: vi.fn() })
    expect(resolve).not.toHaveBeenCalled()

    const fallbackPlugin = weappWebPlugin({ srcDir: 'src' })
    await fallbackPlugin.configResolved?.call({ warn: vi.fn() }, { root, command: 'build' } as any)
    const resolverFixture = await createSfcResolverFixture('<auto-card />')
    const resolvedComponent = join(resolverFixture.root, 'node_modules/known/card.vue')
    await mkdir(dirname(resolvedComponent), { recursive: true })
    await writeFile(resolvedComponent, '<template><view>known</view></template>')
    const resolverPlugin = weappWebPlugin({
      srcDir: 'src',
      __autoImportResolvers: [{ components: { 'auto-card': 'known' } }],
    })
    await resolverPlugin.configResolved?.call({ warn: vi.fn() }, { root: resolverFixture.root, command: 'build' } as any)
    resolve.mockImplementation(async (source: string) => source === 'known' ? { id: resolvedComponent } : null)
    await resolverPlugin.buildStart?.call({ emitFile, resolve, warn: vi.fn() })
    expect(resolve).toHaveBeenCalledWith('known', expect.any(String), { skipSelf: true })
    expect(emitFile).toHaveBeenCalled()

    const defaultPlugin = weappWebPlugin()
    await defaultPlugin.configResolved?.call({ warn: vi.fn() }, { root, command: 'build' } as any)

    const servePlugin = weappWebPlugin({ srcDir: 'src' })
    await servePlugin.configResolved?.call({ warn: vi.fn() }, { root, command: 'serve' } as any)
    emitFile.mockClear()
    await servePlugin.buildStart?.call({ emitFile, warn: vi.fn() })
    expect(emitFile).not.toHaveBeenCalled()
  })

  it('resolves virtual, component, extensionless and SFC style module ids', async () => {
    const { root, srcRoot } = await createPluginFixture()
    const plugin = weappWebPlugin({ srcDir: 'src' })
    await plugin.configResolved?.call({ warn: vi.fn() }, { root, command: 'serve' } as any)
    const resolveId = plugin.resolveId!

    expect(await resolveId('/@weapp-vite/web/entry')).toBe(ENTRY_ID)
    expect(await resolveId('@weapp-vite/web/entry')).toBe(ENTRY_ID)
    expect(await resolveId(AUTO_ROUTES_ID)).toBe(RESOLVED_AUTO_ROUTES_ID)
    expect(await resolveId('/@weapp-vite/web/component/missing')).toBeNull()
    expect(await resolveId('./standalone', join(srcRoot, 'importer.vue'))).toBe(normalizePath(join(srcRoot, 'standalone.vue')))
    expect(await resolveId('./missing', join(srcRoot, 'importer.vue'))).toBeNull()
    expect(await resolveId('./standalone', join(srcRoot, 'importer.js'))).toBeNull()
    expect(await resolveId('./standalone.vue', join(srcRoot, 'importer.vue'))).toBeNull()

    const relativeStyle = './standalone.vue.css?weapp-web-sfc-style&inline'
    expect(await resolveId(relativeStyle, join(srcRoot, 'importer.vue')))
      .toBe(`${normalizePath(join(srcRoot, 'standalone.vue.css'))}?weapp-web-sfc-style&inline`)
    const absoluteStyle = `${join(srcRoot, 'standalone.vue.css')}?weapp-web-sfc-style&inline`
    expect(await resolveId(absoluteStyle)).toBe(absoluteStyle)
    expect(await resolveId('standalone.vue.css&weapp-web-sfc-style')).toBe('standalone.vue.css&weapp-web-sfc-style')
    expect(await resolveId('unknown:module')).toBeNull()
  })

  it('loads virtual, WXML, WXS, WXSS and SFC modules', async () => {
    const { componentDir, pageDir, root, srcRoot } = await createPluginFixture()
    const plugin = weappWebPlugin({ srcDir: 'src' })
    await plugin.configResolved?.call({ warn: vi.fn() }, { root, command: 'build' } as any)
    const load = plugin.load!
    const addWatchFile = vi.fn()
    const warn = vi.fn()
    const context = { addWatchFile, warn }

    await expect(load.call(context, ENTRY_ID)).resolves.toContain('initializePageRoutes')
    await expect(load.call(context, RESOLVED_AUTO_ROUTES_ID)).resolves.toContain('pages/index/index')
    await expect(load.call(context, `${join(pageDir, 'index.wxml')}?weapp-web-template`))
      .resolves
      .toContain('wv-component-layouts-default')
    expect(addWatchFile).toHaveBeenCalledWith(normalizePath(join(pageDir, 'part.wxml')))
    await expect(load.call(context, `${join(pageDir, 'logic.wxs')}?wxs`)).resolves.toContain(`from 'dep.wxs'`)
    expect(addWatchFile).toHaveBeenCalledWith(normalizePath(join(pageDir, 'dep.wxs')))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('仅支持相对或绝对路径'))
    await expect(load.call({}, `${join(pageDir, 'dep.wxs')}?wxs`)).resolves.toContain('ready')
    await expect(load.call(context, `${join(pageDir, 'index.wxss')}?weapp-web-style`)).resolves.toContain('injectStyle')
    await expect(load.call(context, `${join(componentDir, 'index.wxml')}?weapp-web-template`))
      .resolves
      .toContain(`from 'lit'`)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('<camera>'))
    await expect(load.call({}, `${join(componentDir, 'index.wxml')}?weapp-web-template`))
      .resolves
      .toContain(`from 'lit'`)

    const standalonePath = join(srcRoot, 'standalone.vue')
    await expect(plugin.transform!.call({}, await readFile(standalonePath, 'utf8'), standalonePath))
      .resolves
      .toMatchObject({ code: expect.stringContaining('registerWebWevuComponent') })
    await expect(load.call(context, `${standalonePath}?weapp-web-sfc-template`))
      .resolves
      .toContain(`from './standalone-part.wxml?weapp-web-template'`)
    expect(addWatchFile).toHaveBeenCalledWith(normalizePath(join(srcRoot, 'standalone-part.wxml')))
    await expect(load.call({}, `${standalonePath}?weapp-web-sfc-template`))
      .resolves
      .toContain(`from './standalone-part.wxml?weapp-web-template'`)
    await expect(load.call({}, `${standalonePath}?weapp-web-sfc-style`)).resolves.toBe('')
    await expect(load.call({}, `${standalonePath}.css?weapp-web-sfc-style&inline`)).resolves.toBe('')
    await expect(load.call(context, `${join(pageDir, 'missing.vue')}?weapp-web-sfc-template`)).resolves.toBeNull()
    await expect(load.call(context, `${join(pageDir, 'missing.vue.css')}?weapp-web-sfc-style&inline`)).resolves.toBeNull()
    await expect(load.call(context, 'unknown:module')).resolves.toBeNull()
  })

  it('rescans every supported HMR file class and ignores unrelated files', async () => {
    const { pageDir, root } = await createPluginFixture()
    const plugin = weappWebPlugin({ srcDir: 'src' })
    const warn = vi.fn()
    await plugin.configResolved?.call({ warn }, { root, command: 'serve' } as any)
    for (const file of [
      'index.json',
      'index.wxml',
      'logic.wxs',
      'index.wxss',
      'index.js',
      'ignored.txt',
    ]) {
      await plugin.handleHotUpdate?.call({ warn }, { file: join(pageDir, file) })
    }
  })

  it('dispatches transform queries, templates, scripts, styles and UniApp dependencies', async () => {
    const { componentDir, pageDir, root, srcRoot } = await createPluginFixture()
    const packageDir = join(root, 'node_modules/demo-uni')
    await mkdir(packageDir, { recursive: true })
    const uniScript = join(packageDir, 'index.js')
    const uniStyle = join(packageDir, 'style.css')
    const uniStylus = join(packageDir, 'fragment.styl')
    const plainDependency = join(root, 'node_modules/plain/index.js')
    await mkdir(dirname(plainDependency), { recursive: true })
    await writeFile(uniScript, `// #ifdef H5\nexport const platform = 'h5'\n// #endif`)
    await writeFile(uniStyle, `/* #ifdef H5 */\n.web { display: block; }\n/* #endif */`)
    await writeFile(uniStylus, `/* #ifdef H5 */\n.web\n  display block\n/* #endif */`)
    await writeFile(plainDependency, 'export const plain = true')

    const plugin = weappWebPlugin({
      srcDir: 'src',
      __uniApp: { include: ['demo-uni'] },
    })
    await plugin.configResolved?.call({ warn: vi.fn() }, { root, command: 'serve' } as any)
    const transform = plugin.transform!
    const addWatchFile = vi.fn()
    const warn = vi.fn()
    const context = { addWatchFile, warn }

    for (const query of [
      'weapp-web-template',
      'wxs',
      'weapp-web-style',
      'weapp-web-sfc-template',
      'weapp-web-sfc-style',
    ]) {
      await expect(transform.call(context, 'ignored', `${join(pageDir, 'index.js')}?${query}`)).resolves.toBeNull()
    }

    await expect(transform.call(context, '<html></html>', join(root, 'index.html'))).resolves.toBeNull()
    await expect(transform.call(context, '<view />', join(root, 'outside.wxml'))).resolves.toBeNull()
    await expect(transform.call(context, '<view />', join(srcRoot, 'untracked.wxml'))).resolves.toBeNull()
    await expect(transform.call(context, await readFile(join(pageDir, 'index.wxml'), 'utf8'), join(pageDir, 'index.wxml')))
      .resolves
      .toMatchObject({ code: expect.stringContaining('wv-component-layouts-default'), map: null })
    expect(addWatchFile).toHaveBeenCalledWith(normalizePath(join(pageDir, 'part.wxml')))
    await expect(transform.call(context, await readFile(join(componentDir, 'index.wxml'), 'utf8'), join(componentDir, 'index.wxml')))
      .resolves
      .toMatchObject({ code: expect.stringContaining('<camera>'), map: null })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('<camera>'))

    await expect(transform.call(context, await readFile(join(pageDir, 'logic.wxs'), 'utf8'), join(pageDir, 'logic.wxs')))
      .resolves
      .toMatchObject({ code: expect.stringContaining(`from 'dep.wxs'`), map: null })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('仅支持相对或绝对路径'))
    await expect(transform.call(context, '.page { width: 750rpx; }', join(pageDir, 'index.wxss')))
      .resolves
      .toMatchObject({ code: expect.stringContaining('injectStyle'), map: null })
    await expect(transform.call(context, '.page { color: red; }', join(pageDir, 'index.scss')))
      .resolves
      .toEqual({ code: '.page { color: red; }', map: null })
    await expect(transform.call(context, 'plain', join(srcRoot, 'readme.txt'))).resolves.toBeNull()
    await expect(transform.call(context, 'export const local = true', join(srcRoot, 'untracked.js'))).resolves.toBeNull()
    await expect(transform.call(context, await readFile(plainDependency, 'utf8'), plainDependency)).resolves.toBeNull()
    await expect(transform.call(context, await readFile(uniScript, 'utf8'), uniScript))
      .resolves
      .toMatchObject({ code: expect.stringContaining(`platform = 'h5'`), map: null })
    await expect(transform.call(context, await readFile(uniStyle, 'utf8'), uniStyle))
      .resolves
      .toMatchObject({ code: expect.stringContaining('.web'), map: null })
    await expect(transform.call(context, await readFile(uniStylus, 'utf8'), uniStylus))
      .resolves
      .toEqual({ code: '\n.web\n  display block\n', map: null })
    await expect(transform.call(context, '<template><view>fallback</view></template>', join(srcRoot, 'fallback.vue')))
      .resolves
      .toMatchObject({ code: expect.stringContaining('registerWebWevuComponent') })
    await expect(transform.call(context, '', join(srcRoot, 'empty.vue'))).rejects.toThrow()

    await expect(transform.call({}, await readFile(join(pageDir, 'index.wxml'), 'utf8'), join(pageDir, 'index.wxml')))
      .resolves
      .toMatchObject({ code: expect.stringContaining(`from 'lit'`), map: null })
    await expect(transform.call({}, await readFile(join(componentDir, 'index.wxml'), 'utf8'), join(componentDir, 'index.wxml')))
      .resolves
      .toMatchObject({ code: expect.stringContaining('<camera>'), map: null })
    await expect(transform.call({}, await readFile(join(pageDir, 'logic.wxs'), 'utf8'), join(pageDir, 'logic.wxs')))
      .resolves
      .toMatchObject({ code: expect.stringContaining(`from 'dep.wxs'`), map: null })
  })

  it('supports function, object and component-map auto import resolvers', async () => {
    const { root } = await createSfcResolverFixture('<function-card /><object-card /><map-card /><unmatched-card />')
    const packageDir = join(root, 'node_modules/resolver-components')
    await mkdir(packageDir, { recursive: true })
    const componentPaths: Record<string, string> = {}
    for (const name of ['function-card', 'object-card', 'map-card']) {
      const script = join(packageDir, `${name}.vue`)
      componentPaths[name] = script
      await writeFile(script, `<template><view>${name}</view></template>`)
    }

    const plugin = weappWebPlugin({
      srcDir: 'src',
      __autoImportResolvers: [
        (tag: string) => tag === 'function-card'
          ? { from: 'resolver-components/function-card.vue', name: tag }
          : undefined,
        {
          resolve: (tag: string) => tag === 'object-card'
            ? { from: 'resolver-components/object-card.vue', name: tag, resolvedId: componentPaths[tag] }
            : undefined,
        },
        { components: { 'map-card': 'resolver-components/map-card.vue' } },
      ],
    })
    await plugin.configResolved?.call({ warn: vi.fn() }, {
      root,
      command: 'serve',
      createResolver: () => async (request: string) => {
        const name = request.split('/').at(-1)?.replace(/\.vue$/, '') ?? ''
        return componentPaths[name]
      },
    } as any)
    const entry = await plugin.load?.call({}, ENTRY_ID)
    expect(entry).toContain(encodeURIComponent('resolver-components/function-card.vue'))
    expect(entry).toContain(encodeURIComponent('resolver-components/object-card.vue'))
    expect(entry).toContain(encodeURIComponent('resolver-components/map-card.vue'))
  })
})
