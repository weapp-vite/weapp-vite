import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { weappWebPlugin } from '../src/plugin'
import { resolveWebVueSfcStyleLanguage } from '../src/plugin/vueSfc'

describe('weappWebPlugin', () => {
  it('uses one preprocessor for mixed CSS and preprocessed SFC style blocks', () => {
    expect(resolveWebVueSfcStyleLanguage({
      meta: {
        styleBlocks: [
          { lang: 'css' },
          { lang: 'scss' },
          {},
        ],
      },
    } as any, '/src/pages/index.vue')).toBe('scss')

    expect(() => resolveWebVueSfcStyleLanguage({
      meta: {
        styleBlocks: [
          { lang: 'scss' },
          { lang: 'less' },
        ],
      },
    } as any, '/src/pages/index.vue')).toThrow('Vue SFC 暂不支持混合样式语言')
  })

  it('injects the WXSS PostCSS transform during Vite config resolution', () => {
    const plugin = weappWebPlugin()
    const existingPlugin = { postcssPlugin: 'existing' }
    const config = {
      css: {
        postcss: {
          plugins: [existingPlugin],
        },
      },
    }
    const result = (plugin.config as ((config: any) => any)).call({}, config)

    expect(result.css.postcss.plugins).toHaveLength(2)
    expect(result.css.postcss.plugins[0]).toBe(existingPlugin)
    expect(result.css.postcss.plugins[1].postcssPlugin).toBe('weapp-vite-web-wxss')
  })

  it('transforms wxml files to template modules', async () => {
    const plugin = weappWebPlugin()
    const transform = plugin.transform
    expect(typeof transform).toBe('function')
    const result = await (transform as (code: string, id: string) => Promise<any> | any).call(
      {},
      '<view>{{msg}}</view>',
      '/foo/bar.wxml',
    )
    expect(result?.code).toContain(`import { html } from 'lit'`)
    expect(result?.code).toContain('export default render')
  })

  it('transforms wxss files to css injection helpers', async () => {
    const plugin = weappWebPlugin()
    const transform = plugin.transform
    expect(typeof transform).toBe('function')
    const result = await (transform as (code: string, id: string) => Promise<any> | any).call(
      {},
      '.page { width: 750rpx; }',
      '/foo/index.wxss',
    )
    expect(result?.code).toContain('injectStyle')
    expect(result?.code).toContain('export function useStyle')
  })

  it('injects runtime warning and viewport options into entry initializer', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-entry-'))
    const srcRoot = join(root, 'src')
    const pageDir = join(srcRoot, 'pages/index')
    await mkdir(pageDir, { recursive: true })
    await writeFile(join(srcRoot, 'app.js'), 'App({})')
    await writeFile(join(srcRoot, 'app.json'), JSON.stringify({
      pages: ['pages/index/index'],
      tabBar: {
        color: '#666666',
        selectedColor: '#07c160',
        backgroundColor: '#ffffff',
        list: [{
          pagePath: '/pages/index/index',
          text: '首页',
          iconPath: 'assets/home.png',
        }],
      },
    }))
    await writeFile(join(pageDir, 'index.js'), 'Component({})')
    await writeFile(join(pageDir, 'index.wxml'), '<view>index</view>')
    await writeFile(join(pageDir, 'index.scss'), '.page { width: 750rpx; }')
    await writeFile(join(pageDir, 'index.json'), JSON.stringify({ navigationBarTitleText: '首页' }))

    const plugin = weappWebPlugin({
      srcDir: 'src',
      runtime: {
        executionMode: 'safe',
        warnings: {
          level: 'off',
          dedupe: false,
        },
        viewport: {
          mode: 'responsive',
          maxWidth: 414,
          desktopBreakpoint: 720,
        },
        routing: {
          mode: 'history',
          base: '/mini',
        },
        seo: {
          defaultTitle: '商城',
          titleTemplate: '%s | Demo',
          description: '商品详情',
        },
        resourceHints: {
          links: [{ rel: 'preconnect', href: 'https://cdn.example.test' }],
        },
      },
    })
    await (plugin.configResolved as ((...args: any[]) => any))?.call({ warn() {} } as any, { root, command: 'build' } as any)

    const entryId = (plugin.resolveId as ((...args: any[]) => any))?.('/@weapp-vite/web/entry') as string
    expect(entryId).toBeTruthy()

    const code = await (plugin.load as ((...args: any[]) => any))?.call({} as any, entryId) as string
    expect(code).toContain('initializePageRoutes(["pages/index/index"]')
    expect(code.indexOf('/src/app.js'))
      .toBeLessThan(code.indexOf('/src/pages/index/index.js'))
    expect(code).toContain('"tabBar":{"color":"#666666","selectedColor":"#07c160","backgroundColor":"#ffffff","borderStyle":"black","position":"bottom","custom":false,"list":[{"pagePath":"pages/index/index","text":"首页","iconPath":"assets/home.png"}]}')
    expect(code).toContain('"runtime":{"executionMode":"safe","warnings":{"level":"off","dedupe":false},"viewport":{"mode":"responsive","maxWidth":414,"desktopBreakpoint":720},"routing":{"mode":"history","base":"/mini"},"seo":{"defaultTitle":"商城","titleTemplate":"%s | Demo","description":"商品详情"},"resourceHints":{"links":[{"rel":"preconnect","href":"https://cdn.example.test"}]}}')
    expect(code).toContain('"rpx":{"designWidth":750}')
    const transformedPage = await (plugin.transform as (code: string, id: string) => Promise<any> | any).call(
      {},
      'Component({})',
      join(pageDir, 'index.js'),
    )
    expect(transformedPage?.code).toContain('registerPage')
    expect(transformedPage?.code).toContain('navigationBar: {"title":"首页"}')
    expect(transformedPage?.code).toContain('index.scss?inline')
  })

  it('loads runtime polyfill from a Vite fs path in virtual entry modules', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-entry-polyfill-'))
    const srcRoot = join(root, 'src')
    const pageDir = join(srcRoot, 'pages/index')
    await mkdir(pageDir, { recursive: true })
    await writeFile(join(srcRoot, 'app.js'), 'App({})')
    await writeFile(join(srcRoot, 'app.json'), JSON.stringify({ pages: ['pages/index/index'] }))
    await writeFile(join(pageDir, 'index.js'), 'Page({})')
    await writeFile(join(pageDir, 'index.wxml'), '<view>index</view>')

    const plugin = weappWebPlugin({ srcDir: 'src' })
    await (plugin.configResolved as ((...args: any[]) => any))?.call({ warn() {} } as any, { root, command: 'serve' } as any)

    const entryId = (plugin.resolveId as ((...args: any[]) => any))?.('/@weapp-vite/web/entry') as string
    const code = await (plugin.load as ((...args: any[]) => any))?.call({} as any, entryId) as string

    expect(code).toMatch(/from '\/@fs\/.*runtime\/(index\.mjs|polyfill\.ts)'/)
    expect(code).not.toContain('@weapp-vite/web/runtime/polyfill')
  })

  it('uses the runtime provider module id and HMR hook when supplied', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-runtime-provider-'))
    const srcRoot = join(root, 'src')
    await mkdir(srcRoot, { recursive: true })
    await writeFile(join(srcRoot, 'app.js'), 'App({})')
    await writeFile(join(srcRoot, 'app.json'), JSON.stringify({ pages: [] }))

    const plugin = weappWebPlugin({
      srcDir: 'src',
      __runtimeProvider: {
        moduleId: 'virtual:weapp-vite/runtime',
        hmrAcceptCode: 'providerAccept()',
      },
    })
    await (plugin.configResolved as ((...args: any[]) => any))?.call({ warn() {} } as any, { root, command: 'serve' } as any)

    const entryId = (plugin.resolveId as ((...args: any[]) => any))?.('/@weapp-vite/web/entry') as string
    const entryCode = await (plugin.load as ((...args: any[]) => any))?.call({} as any, entryId) as string
    const transform = plugin.transform as (code: string, id: string) => Promise<any> | any
    const result = await transform.call({}, 'App({})', join(srcRoot, 'app.js'))

    expect(entryCode).toContain(`from 'virtual:weapp-vite/runtime'`)
    expect(result?.code).toContain(`from 'virtual:weapp-vite/runtime'`)
    expect(result?.code).toContain('providerAccept()')
    expect(result?.code).not.toContain('import.meta.hot.accept()')
  })

  it('transforms app modules to import runtime polyfill through a Vite fs path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-transform-polyfill-'))
    const srcRoot = join(root, 'src')
    await mkdir(srcRoot, { recursive: true })
    await writeFile(join(srcRoot, 'app.js'), 'App({})')
    await writeFile(join(srcRoot, 'app.json'), JSON.stringify({ pages: [] }))

    const plugin = weappWebPlugin({ srcDir: 'src' })
    await (plugin.configResolved as ((...args: any[]) => any))?.call({ warn() {} } as any, { root, command: 'serve' } as any)

    const transform = plugin.transform as (code: string, id: string) => Promise<any> | any
    const result = await transform.call({}, 'App({})', join(srcRoot, 'app.js'))

    expect(result?.code).toMatch(/from '\/@fs\/.*runtime\/(index\.mjs|polyfill\.ts)'/)
    expect(result?.code).toContain('registerApp')
    expect(result?.code).not.toContain('@weapp-vite/web/runtime/polyfill')
  })

  it('installs scoped registration for indirect native component factories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-indirect-component-'))
    const srcRoot = join(root, 'src')
    const componentDir = join(srcRoot, 'components/probe')
    await mkdir(componentDir, { recursive: true })
    await writeFile(join(srcRoot, 'app.js'), 'App({})')
    await writeFile(join(srcRoot, 'app.json'), JSON.stringify({
      pages: [],
      usingComponents: {
        probe: '/components/probe/index',
      },
    }))
    const componentPath = join(componentDir, 'index.ts')
    const componentSource = `import { ComponentWithComputed } from 'miniprogram-computed'\nComponentWithComputed({ data: {} })`
    await writeFile(componentPath, componentSource)
    await writeFile(join(componentDir, 'index.wxml'), '<view>probe</view>')

    const plugin = weappWebPlugin({
      srcDir: 'src',
      __runtimeProvider: {
        moduleId: 'virtual:weapp-vite/runtime',
      },
    })
    await (plugin.configResolved as ((...args: any[]) => any))?.call({ warn() {} } as any, { root, command: 'serve' } as any)

    const transformed = await (plugin.transform as ((...args: any[]) => any)).call({}, componentSource, componentPath)
    expect(transformed.code).toContain('installWebModuleRegistration')
    expect(transformed.code).toContain('kind: "component"')
    expect(transformed.code).toContain('__weapp_web_restore_registration__()')
    expect(transformed.code).toContain('ComponentWithComputed({ data: {} })')
  })

  it('discovers pages without app json and registers aliased Wevu defineComponent calls', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-native-wevu-'))
    const srcRoot = join(root, 'src')
    const pageDir = join(srcRoot, 'pages/index')
    await mkdir(pageDir, { recursive: true })
    await writeFile(join(srcRoot, 'app.ts'), `import { createApp } from 'wevu'\ncreateApp({})`)
    const pagePath = join(pageDir, 'index.ts')
    const pageSource = `import { defineComponent as defineWevuComponent } from 'wevu'\nexport default defineWevuComponent({ data: () => ({ ready: true }) })`
    await writeFile(pagePath, pageSource)
    await writeFile(join(pageDir, 'index.wxml'), '<view>{{ ready }}</view>')

    const plugin = weappWebPlugin({
      srcDir: 'src',
      __runtimeProvider: {
        moduleId: 'virtual:weapp-vite/runtime',
      },
    })
    await (plugin.configResolved as ((...args: any[]) => any))?.call({ warn() {} } as any, { root, command: 'serve' } as any)

    const entryCode = await (plugin.load as ((...args: any[]) => any))?.call({}, '\0@weapp-vite/web/entry') as string
    expect(entryCode).toContain('/src/pages/index/index.ts')
    expect(entryCode).toContain('initializePageRoutes(["pages/index/index"]')

    const transformed = await (plugin.transform as ((...args: any[]) => any)).call({}, pageSource, pagePath)
    expect(transformed.code).toContain('registerWebWevuComponent')
    expect(transformed.code).toContain('kind: "page"')
  })

  it('compiles Vue SFC pages into the shared Web runtime registration model', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-sfc-'))
    const srcRoot = join(root, 'src')
    const pageDir = join(srcRoot, 'pages/index')
    await mkdir(pageDir, { recursive: true })
    await writeFile(join(root, 'index.html'), '<div id="app"></div><script type="module" src="/@weapp-vite/web/entry"></script>')
    await writeFile(join(srcRoot, 'app.vue'), `
<script setup lang="ts">
defineAppJson({ pages: ['pages/index/index'] })
</script>
    `.trim())
    const componentPath = join(srcRoot, 'components/status-card.vue')
    await mkdir(join(srcRoot, 'components'), { recursive: true })
    await writeFile(componentPath, `
<script setup lang="ts">
defineComponentJson({ component: true })
const label: string = 'ready'
</script>
<template><view>{{ label }}</view></template>
    `.trim())
    const pagePath = join(pageDir, 'index.vue')
    const pageSource = `
<script setup lang="ts">
import { ref } from 'wevu'
import StatusCard from '../../components/status-card.vue'
definePageJson({ navigationBarTitleText: 'SFC 首页' })
const count = ref<number>(0)
</script>
<template><view class="page"><status-card /><button @tap="count += 1">{{ count }}</button></view></template>
<style>.page { width: 750rpx; }</style>
    `.trim()
    await writeFile(pagePath, pageSource)

    const plugin = weappWebPlugin({
      srcDir: 'src',
      __runtimeProvider: {
        moduleId: 'virtual:weapp-vite/runtime',
        hmrAcceptCode: 'providerAccept()',
      },
    })
    await (plugin.configResolved as ((...args: any[]) => any))?.call({ warn() {} } as any, { root, command: 'serve' } as any)

    const entryCode = await (plugin.load as ((...args: any[]) => any))?.call({} as any, '\0@weapp-vite/web/entry') as string
    expect(entryCode).toContain('/src/pages/index/index.vue')
    expect(entryCode).toContain('/src/components/status-card.vue')
    expect(entryCode).toContain('initializePageRoutes(["pages/index/index"]')

    const transformed = await (plugin.transform as ((...args: any[]) => any)).call({}, pageSource, pagePath)
    expect(transformed.code).toContain('registerWebWevuComponent')
    expect(transformed.code).toContain(`kind: "page"`)
    expect(transformed.code).toContain('?weapp-web-sfc-template')
    expect(transformed.code).toContain('.vue.css?weapp-web-sfc-style&inline')
    expect(transformed.code).toContain('providerAccept()')
    expect(transformed.code).not.toContain('ref<number>')

    const transformedComponent = await (plugin.transform as ((...args: any[]) => any)).call(
      {},
      await readFile(componentPath, 'utf8'),
      componentPath,
    )
    expect(transformedComponent.code).toContain('registerWebWevuComponent')
    expect(transformedComponent.code).not.toContain(': string')

    const templateCode = await (plugin.load as ((...args: any[]) => any))?.call(
      { warn() {}, addWatchFile() {} },
      `${pagePath}?weapp-web-sfc-template`,
    ) as string
    expect(templateCode).toContain(`import { html } from 'lit'`)
    expect(templateCode).toContain('weapp-button')
    expect(templateCode).toContain('SFC 首页')

    const styleCode = await (plugin.load as ((...args: any[]) => any))?.call(
      {},
      `${pagePath}.css?weapp-web-sfc-style&inline`,
    ) as string
    expect(styleCode).toContain('750rpx')

    const styleTransform = await (plugin.transform as ((...args: any[]) => any)).call(
      {},
      styleCode,
      `${pagePath}.css?weapp-web-sfc-style&inline`,
    )
    const templateTransform = await (plugin.transform as ((...args: any[]) => any)).call(
      {},
      templateCode,
      `${pagePath}?weapp-web-sfc-template`,
    )
    expect(styleTransform).toBeNull()
    expect(templateTransform).toBeNull()
  })

  it('discovers auto-routed SFC pages and exposes them through the web routes module', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-sfc-routes-'))
    const srcRoot = join(root, 'src')
    const pageDir = join(srcRoot, 'pages/home')
    const subPageDir = join(srcRoot, 'packageA/pages/detail')
    await mkdir(pageDir, { recursive: true })
    await mkdir(subPageDir, { recursive: true })
    await writeFile(join(srcRoot, 'app.vue'), `
<script setup>
defineAppJson({})
</script>
    `.trim())
    await writeFile(join(pageDir, 'index.vue'), '<template><view>home</view></template>')
    await writeFile(join(subPageDir, 'index.vue'), '<template><view>detail</view></template>')

    const plugin = weappWebPlugin({ srcDir: 'src' })
    await (plugin.configResolved as ((...args: any[]) => any))?.call({ warn() {} } as any, { root, command: 'build' } as any)
    const routesId = (plugin.resolveId as ((...args: any[]) => any))?.('weapp-vite/auto-routes') as string
    const routesCode = await (plugin.load as ((...args: any[]) => any))?.call({}, routesId) as string

    expect(routesCode).toContain('"pages/home/index"')
    expect(routesCode).toContain('"packageA/pages/detail/index"')
    expect(routesCode).toContain('"root":"packageA"')
  })

  it('resolves bare package imports used by Vue SFC style src blocks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-sfc-style-src-'))
    const srcRoot = join(root, 'src')
    const pageDir = join(srcRoot, 'pages/index')
    const packageDir = join(root, 'node_modules/demo-style')
    await mkdir(pageDir, { recursive: true })
    await mkdir(packageDir, { recursive: true })
    await writeFile(join(packageDir, 'package.json'), JSON.stringify({
      name: 'demo-style',
      exports: {
        './theme.css': './theme.css',
      },
    }))
    await writeFile(join(packageDir, 'theme.css'), '.external-style { color: red; }')
    await writeFile(join(srcRoot, 'app.vue'), '<script setup>defineAppJson({ pages: ["pages/index/index"] })</script>')
    const pagePath = join(pageDir, 'index.vue')
    await writeFile(pagePath, '<template><view class="external-style">ready</view></template><style src="demo-style/theme.css"></style>')

    const plugin = weappWebPlugin({ srcDir: 'src' })
    await (plugin.configResolved as ((...args: any[]) => any))?.call({ warn() {} } as any, {
      root,
      command: 'build',
      createResolver: () => async (request: string) => request === 'demo-style/theme.css'
        ? join(packageDir, 'theme.css')
        : undefined,
    } as any)
    const styleCode = await (plugin.load as ((...args: any[]) => any))?.call(
      {},
      `${pagePath}.css?weapp-web-sfc-style&inline`,
    ) as string

    expect(styleCode).toContain('.external-style')
    expect(styleCode).toContain('color: red')
  })

  it('collects and invalidates recursive external Vue SFC components through auto-import resolvers', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-external-sfc-'))
    const srcRoot = join(root, 'src')
    const pageDir = join(srcRoot, 'pages/index')
    const packageDir = join(root, 'node_modules/@demo/ui')
    const parentPath = join(packageDir, 'components/wd-parent/wd-parent.vue')
    const childPath = join(packageDir, 'components/wd-child/wd-child.vue')
    await mkdir(pageDir, { recursive: true })
    await mkdir(join(packageDir, 'components/wd-parent'), { recursive: true })
    await mkdir(join(packageDir, 'components/wd-child'), { recursive: true })
    await writeFile(join(srcRoot, 'app.vue'), '<script setup>defineAppJson({ pages: ["pages/index/index"] })</script>')
    await writeFile(join(pageDir, 'index.vue'), '<template><wd-parent /></template>')
    await writeFile(parentPath, `
<script setup>
import { ref } from 'vue'
const ready = ref(true)
</script>
<template>
<!-- #ifdef H5 -->
<view><wd-child />{{ ready }}</view>
<!-- #endif -->
</template>
    `.trim())
    await writeFile(childPath, '<template><view>child-v1</view></template>')

    const componentMap: Record<string, string> = {
      'wd-parent': '@demo/ui/components/wd-parent/wd-parent.vue',
      'wd-child': '@demo/ui/components/wd-child/wd-child.vue',
    }
    const plugin = weappWebPlugin({
      srcDir: 'src',
      __uniApp: { include: ['@demo/ui'] },
      __autoImportResolvers: [{ components: componentMap }],
    })
    const resolvedConfig = {
      root,
      command: 'serve',
      optimizeDeps: { exclude: ['existing-dependency'], include: ['existing-include'] },
      createResolver: () => async (request: string) => componentMap['wd-parent'] === request
        ? parentPath
        : componentMap['wd-child'] === request
          ? childPath
          : undefined,
    }
    await (plugin.configResolved as ((...args: any[]) => any))?.call({ warn() {} } as any, resolvedConfig as any)

    const entryCode = await (plugin.load as ((...args: any[]) => any))?.call({}, '\0@weapp-vite/web/entry') as string
    expect(entryCode).toContain('import \'/@weapp-vite/web/component/%40demo%2Fui%2Fcomponents%2Fwd-parent%2Fwd-parent.vue\'')
    expect(entryCode).toContain('import \'/@weapp-vite/web/component/%40demo%2Fui%2Fcomponents%2Fwd-child%2Fwd-child.vue\'')
    expect(entryCode).not.toContain(packageDir)
    expect(resolvedConfig.optimizeDeps.exclude).toEqual(['existing-dependency'])
    expect(resolvedConfig.optimizeDeps.include).toEqual(['existing-include'])
    expect(await (plugin.resolveId as ((...args: any[]) => any))?.call(
      {},
      '/@weapp-vite/web/component/%40demo%2Fui%2Fcomponents%2Fwd-parent%2Fwd-parent.vue',
    )).toBe(`${parentPath}?weapp-web-component`)

    const parentCode = await (plugin.transform as ((...args: any[]) => any)).call(
      {},
      await readFile(parentPath, 'utf8'),
      parentPath,
    )
    expect(parentCode.code).toContain('wevu')
    expect(parentCode.code).toContain('__external__/@demo/ui/components/wd-parent/wd-parent')
    const parentTemplate = await (plugin.load as ((...args: any[]) => any))?.call(
      { warn() {}, addWatchFile() {} },
      `${parentPath}?weapp-web-sfc-template`,
    ) as string
    expect(parentTemplate).toContain('wd-child')
    expect(parentTemplate).not.toContain('#ifdef')

    await writeFile(childPath, '<template><view>child-v2</view></template>')
    await (plugin.handleHotUpdate as ((...args: any[]) => any))?.call({ warn() {} }, { file: childPath })
    const childTemplate = await (plugin.load as ((...args: any[]) => any))?.call(
      { warn() {}, addWatchFile() {} },
      `${childPath}?weapp-web-sfc-template`,
    ) as string
    expect(childTemplate).toContain('child-v2')
  })

  it('transforms external native components resolved through the shared component graph', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-external-native-'))
    const srcRoot = join(root, 'src')
    const packageDir = join(root, 'node_modules/@demo/ui')
    const componentPath = join(packageDir, 'icon/index.js')
    const childPath = join(packageDir, 'badge/index.js')
    const componentRequest = '@demo/ui/icon/index'
    const componentSource = 'Component({ properties: { prefix: String } })'
    const childSource = 'Component({ properties: { count: Number } })'
    await mkdir(srcRoot, { recursive: true })
    await mkdir(join(packageDir, 'icon'), { recursive: true })
    await mkdir(join(packageDir, 'badge'), { recursive: true })
    await writeFile(join(srcRoot, 'app.js'), 'App({})')
    await writeFile(join(srcRoot, 'app.json'), JSON.stringify({
      pages: [],
      usingComponents: {
        icon: componentRequest,
      },
    }))
    await writeFile(componentPath, componentSource)
    await writeFile(join(packageDir, 'icon/index.json'), JSON.stringify({
      component: true,
      usingComponents: {
        badge: '../badge/index',
      },
    }))
    await writeFile(join(packageDir, 'icon/index.wxml'), '<badge count="1" /><view>{{ prefix }}</view>')
    await writeFile(childPath, childSource)
    await writeFile(join(packageDir, 'badge/index.wxml'), '<view>{{ count }}</view>')

    const plugin = weappWebPlugin({ srcDir: 'src' })
    await (plugin.configResolved as ((...args: any[]) => any))?.call({ warn() {} } as any, {
      root,
      command: 'serve',
      createResolver: () => async (request: string) => request === componentRequest
        ? componentPath
        : undefined,
    } as any)

    const entryCode = await (plugin.load as ((...args: any[]) => any))?.call({}, '\0@weapp-vite/web/entry') as string
    const virtualId = `/@weapp-vite/web/component/${encodeURIComponent(componentRequest)}`
    expect(entryCode).toContain(`import '${virtualId}'`)
    const childVirtualId = `/@weapp-vite/web/component/${encodeURIComponent('__external__/@demo/ui/badge/index')}`
    expect(entryCode).toContain(`import '${childVirtualId}'`)

    const resolvedId = await (plugin.resolveId as ((...args: any[]) => any))?.call({}, virtualId) as string
    expect(resolvedId).toBe(`${componentPath}?weapp-web-component`)

    const transformed = await (plugin.transform as ((...args: any[]) => any)).call(
      {},
      componentSource,
      resolvedId,
    )
    expect(transformed.code).toContain('registerComponent')
    expect(transformed.code).toContain('kind: "component"')

    const childResolvedId = await (plugin.resolveId as ((...args: any[]) => any))?.call({}, childVirtualId) as string
    expect(childResolvedId).toBe(`${childPath}?weapp-web-component`)
    const transformedChild = await (plugin.transform as ((...args: any[]) => any)).call(
      {},
      childSource,
      childResolvedId,
    )
    expect(transformedChild.code).toContain('registerComponent')
    expect(transformedChild.code).toContain('__external__/@demo/ui/badge/index')
  })
})
