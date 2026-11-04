import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { readFrameworkCatalog, selectFrameworkTarget } from './catalog'
import { createControlledProject } from './project'

describe('controlled uni Vue2 toolchain', () => {
  it('pins implicit compiler and platform dependencies before any target runs', async () => {
    const catalog = await readFrameworkCatalog()
    const version = '2.0.2-5030320261023001'
    for (const target of ['mp-weixin', 'mp-alipay', 'mp-baidu', 'mp-jd', 'quickapp-webview']) {
      const selected = selectFrameworkTarget(catalog, 'uni-vue2', version, target)
      const project = createControlledProject(selected.release, selected.target)
      expect(project.dependencies).toMatchObject({
        '@dcloudio/uni-cli-i18n': version,
        '@dcloudio/uni-i18n': version,
        '@dcloudio/uni-mp-weixin': version,
        '@dcloudio/uni-stat': version,
        '@dcloudio/vue-cli-plugin-hbuilderx': version,
        '@vue/cli-service': '4.5.19',
        '@vue/cli-plugin-babel': '4.5.19',
        '@vue/babel-preset-app': '4.5.19',
        '@babel/core': '7.24.7',
        '@babel/plugin-transform-runtime': '7.24.7',
        '@babel/runtime': '7.24.7',
        'babel-plugin-import': '1.13.8',
        'regenerator-runtime': '0.14.1',
        'webpack': '4.47.0',
        'postcss': '7.0.39',
      })
      expect(project.command).toContain(target)
    }
  })

  it('provides executable controlled Babel and PostCSS configurations', async () => {
    const selected = selectFrameworkTarget(await readFrameworkCatalog(), 'uni-vue2', '2.0.2-5030320261023001', 'mp-alipay')
    const project = createControlledProject(selected.release, selected.target)
    const babel = { exports: {} as { presets: unknown[], plugins: Array<string | [string, { customName: (name: string) => string }]> } }
    runInNewContext(project.files['babel.config.js']!, { module: babel })
    expect(babel.exports.presets).toEqual([['@vue/app', { modules: 'commonjs', useBuiltIns: 'entry' }]])
    const importPlugin = babel.exports.plugins[0] as [string, { customName: (name: string) => string }]
    expect(importPlugin[1].customName('uni-card')).toBe('@dcloudio/uni-ui/lib/uni-card/uni-card')
    expect(babel.exports.plugins).toContain('@babel/plugin-transform-runtime')

    const root = path.resolve('controlled-source')
    const postcss = { exports: {} as { parser: string, plugins: Array<{ resolve: (id: string) => string } | string> } }
    const requests: string[] = []
    runInNewContext(project.files['postcss.config.js']!, {
      module: postcss,
      process: { env: { UNI_INPUT_DIR: root } },
      require(id: string) {
        requests.push(id)
        if (id === 'path') {
          return path
        }
        return id === 'postcss-import' || id === 'autoprefixer' ? (options: unknown) => options : id
      },
    })
    expect(requests).toEqual(['path', 'postcss-comment', 'postcss-import', 'autoprefixer', '@dcloudio/vue-cli-plugin-uni/packages/postcss'])
    expect(postcss.exports.parser).toBe('postcss-comment')
    const importer = postcss.exports.plugins[0] as { resolve: (id: string) => string }
    expect(importer.resolve('~@/styles/main.css')).toBe(path.join(root, 'styles/main.css'))
    expect(importer.resolve('@/styles/main.css')).toBe(path.join(root, 'styles/main.css'))
    expect(importer.resolve('/styles/main.css')).toBe(path.join(root, 'styles/main.css'))
    expect(importer.resolve('//cdn.example/styles.css')).toBe('//cdn.example/styles.css')
    expect(importer.resolve('package/style.css')).toBe('package/style.css')
    expect(postcss.exports.plugins[1]).toEqual({ remove: true })
  })

  it('disables optional template prettification without replacing compiler options', async () => {
    const selected = selectFrameworkTarget(await readFrameworkCatalog(), 'uni-vue2', '2.0.2-5030320261023001', 'mp-weixin')
    const project = createControlledProject(selected.release, selected.target)
    interface LoaderOptions { compiler: string, prettify: boolean, compilerOptions: { preserveWhitespace: boolean } }
    const current: LoaderOptions = { compiler: 'official-uni-compiler', prettify: true, compilerOptions: { preserveWhitespace: false } }
    let updated: LoaderOptions | undefined
    const vue = { exports: {} as { productionSourceMap: boolean, chainWebpack: (config: unknown) => void } }
    runInNewContext(project.files['vue.config.js']!, { module: vue })
    vue.exports.chainWebpack({
      module: {
        rule(name: string) {
          expect(name).toBe('vue')
          return {
            use(loader: string) {
              expect(loader).toBe('vue-loader')
              return {
                tap: (transform: (options: LoaderOptions) => LoaderOptions) => {
                  updated = transform(current)
                },
              }
            },
          }
        },
      },
    })
    expect(vue.exports.productionSourceMap).toBe(false)
    expect(updated).toEqual({ ...current, prettify: false })
    expect(updated?.compilerOptions).toBe(current.compilerOptions)
    expect(current.prettify).toBe(true)
  })
})
