import os from 'node:os'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 测试临时工程目录仍沿用 fs-extra 以复用现有文件辅助方法
import fs from 'fs-extra'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { createCompilerContext } from '../../createContext'

const tempRoots: string[] = []
const RUNTIME_ENTRY_IMPORT = path.resolve(import.meta.dirname, '../../plugins/vue/runtime.ts').replace(/\\/g, '/')

async function createTempRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-layout-native-build-'))
  tempRoots.push(root)
  return root
}

async function writeNativeDynamicLayoutProjectFiles(root: string) {
  const srcRoot = path.join(root, 'src')
  await fs.ensureDir(path.join(srcRoot, 'pages', 'index'))
  await fs.ensureDir(path.join(srcRoot, 'layouts', 'default'))
  await fs.ensureDir(path.join(srcRoot, 'layouts', 'admin'))

  await fs.writeJson(path.join(root, 'package.json'), {
    name: 'layout-build-native-test',
    private: true,
    version: '0.0.0',
  }, { spaces: 2 })

  await fs.ensureSymlink(path.join(process.cwd(), 'node_modules'), path.join(root, 'node_modules'))

  await fs.writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx1234567890abcf',
    compileType: 'miniprogram',
    miniprogramRoot: 'dist/',
    srcMiniprogramRoot: 'src/',
    setting: {},
  }, { spaces: 2 })

  await fs.writeFile(path.join(root, 'vite.config.ts'), [
    'import { defineConfig } from \'weapp-vite\'',
    '',
    'export default defineConfig({',
    '  resolve: {',
    '    alias: {',
    `      'weapp-vite/runtime': '${RUNTIME_ENTRY_IMPORT}',`,
    '    },',
    '  },',
    '  weapp: {',
    '    srcRoot: \'src\',',
    '  },',
    '})',
    '',
  ].join('\n'), 'utf8')

  await fs.writeFile(path.join(srcRoot, 'app.json'), JSON.stringify({
    pages: [
      'pages/index/index',
    ],
  }, null, 2), 'utf8')
  await fs.writeFile(path.join(srcRoot, 'app.ts'), 'App({})\n', 'utf8')

  await fs.writeFile(path.join(srcRoot, 'layouts', 'default', 'index.json'), JSON.stringify({
    component: true,
  }, null, 2), 'utf8')
  await fs.writeFile(path.join(srcRoot, 'layouts', 'default', 'index.wxml'), '<view class="layout-default"><slot /></view>', 'utf8')
  await fs.writeFile(path.join(srcRoot, 'layouts', 'default', 'index.wxss'), '.layout-default { padding: 12rpx; }', 'utf8')
  await fs.writeFile(path.join(srcRoot, 'layouts', 'default', 'index.ts'), 'Component({ data: { marker: "default-layout" } })', 'utf8')

  await fs.writeFile(path.join(srcRoot, 'layouts', 'admin', 'index.json'), JSON.stringify({
    component: true,
  }, null, 2), 'utf8')
  await fs.writeFile(path.join(srcRoot, 'layouts', 'admin', 'index.wxml'), [
    '<view class="layout-admin">',
    '  <view class="layout-admin__title">{{title || "admin title"}}</view>',
    '  <slot />',
    '</view>',
  ].join('\n'), 'utf8')
  await fs.writeFile(path.join(srcRoot, 'layouts', 'admin', 'index.wxss'), '.layout-admin { padding: 24rpx; }', 'utf8')
  await fs.writeFile(path.join(srcRoot, 'layouts', 'admin', 'index.ts'), 'Component({ data: { marker: "admin-layout" } })', 'utf8')

  await fs.writeFile(path.join(srcRoot, 'pages', 'index', 'index.json'), JSON.stringify({
    navigationBarTitleText: 'Native Layout Build',
  }, null, 2), 'utf8')
  await fs.writeFile(path.join(srcRoot, 'pages', 'index', 'index.wxml'), '<view class="page">native page</view>', 'utf8')
  await fs.writeFile(path.join(srcRoot, 'pages', 'index', 'index.ts'), [
    'import { setPageLayout } from \'weapp-vite/runtime\'',
    '',
    'definePageMeta({',
    '  layout: \'default\',',
    '})',
    '',
    'Page({',
    '  onLoad() {',
    '    setPageLayout(\'admin\', {',
    '      title: \'Native Admin Layout\',',
    '    })',
    '  },',
    '})',
    '',
  ].join('\n'), 'utf8')
}

describe('layout build regression (native runtime switching)', () => {
  afterAll(async () => {
    await Promise.all(tempRoots.map(root => fs.remove(root)))
    tempRoots.length = 0
  })

  it('emits native layout assets and injects runtime switching helpers for native pages', async () => {
    const root = await createTempRoot()
    await writeNativeDynamicLayoutProjectFiles(root)

    const ctx = await createCompilerContext({
      cwd: root,
      isDev: false,
      mode: 'production',
      inlineConfig: {
        build: {
          write: false,
        },
      },
    })

    const buildResult = await ctx.buildService.build()
    const outputs = Array.isArray(buildResult)
      ? buildResult.flatMap(item => item.output)
      : buildResult.output

    const pageChunk = outputs.find(output => output.type === 'chunk' && output.fileName === 'pages/index/index.js')
    const pageTemplate = outputs.find(output => output.type === 'asset' && output.fileName === 'pages/index/index.wxml')
    const pageJson = outputs.find(output => output.type === 'asset' && output.fileName === 'pages/index/index.json')
    const defaultLayoutChunk = outputs.find(output => output.type === 'chunk' && output.fileName === 'layouts/default/index.js')
    const adminLayoutChunk = outputs.find(output => output.type === 'chunk' && output.fileName === 'layouts/admin/index.js')
    const adminLayoutTemplate = outputs.find(output => output.type === 'asset' && output.fileName === 'layouts/admin/index.wxml')

    expect(pageChunk).toBeTruthy()
    expect(pageTemplate).toBeTruthy()
    expect(pageJson).toBeTruthy()
    expect(defaultLayoutChunk).toBeTruthy()
    expect(adminLayoutChunk).toBeTruthy()
    expect(adminLayoutTemplate).toBeTruthy()

    expect(pageChunk!.code).toContain('__wevuSetPageLayout')
    expect(pageChunk!.code).toContain('__wv_page_layout_name')
    expect(pageChunk!.code).toContain('setData')
    expect(pageChunk!.code).not.toContain('definePageMeta')

    const pageTemplateSource = String(pageTemplate!.source)
    expect(pageTemplateSource).toContain(`__wv_page_layout_name === 'admin'`)
    expect(pageTemplateSource).toContain(`!__wv_page_layout_name || __wv_page_layout_name === 'default'`)
    expect(pageTemplateSource).toContain('title="{{(__wv_page_layout_props&&__wv_page_layout_props.title)}}"')

    expect(String(pageJson!.source)).toContain('"weapp-layout-default": "/layouts/default/index"')
    expect(String(pageJson!.source)).toContain('"weapp-layout-admin": "/layouts/admin/index"')
    expect(String(adminLayoutTemplate!.source)).toContain('<slot />')
  })
})
