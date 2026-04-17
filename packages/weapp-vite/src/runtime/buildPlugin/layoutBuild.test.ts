import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { createCompilerContext } from '../../createContext'

const tempRoots: string[] = []
const DEFINE_CONFIG_IMPORT = path.resolve(import.meta.dirname, '../../config.ts').replace(/\\/g, '/')
const WEAPP_VITE_PACKAGE_ROOT = path.resolve(import.meta.dirname, '../../..')

async function createTempRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-layout-build-'))
  tempRoots.push(root)
  return root
}

async function writeJson(file: string, value: unknown) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function linkWorkspaceWeappVitePackage(root: string) {
  const nodeModulesRoot = path.join(root, 'node_modules')
  await fs.mkdir(nodeModulesRoot, { recursive: true })
  await fs.symlink(
    WEAPP_VITE_PACKAGE_ROOT,
    path.join(nodeModulesRoot, 'weapp-vite'),
    'dir',
  )
}

async function writeProjectFiles(root: string) {
  const srcRoot = path.join(root, 'src')
  await fs.mkdir(path.join(srcRoot, 'pages', 'index'), { recursive: true })
  await fs.mkdir(path.join(srcRoot, 'layouts'), { recursive: true })
  await fs.mkdir(path.join(srcRoot, 'shared'), { recursive: true })

  await writeJson(path.join(root, 'package.json'), {
    name: 'layout-build-test',
    private: true,
    version: '0.0.0',
  })

  await linkWorkspaceWeappVitePackage(root)

  await writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx1234567890abcd',
    compileType: 'miniprogram',
    miniprogramRoot: 'dist/',
    srcMiniprogramRoot: 'src/',
    setting: {},
  })

  await fs.writeFile(path.join(root, 'vite.config.ts'), [
    `import { defineConfig } from '${DEFINE_CONFIG_IMPORT}'`,
    '',
    'export default defineConfig({',
    '  weapp: {',
    '    srcRoot: \'src\',',
    '  },',
    '  chunks: {',
    '    sharedStrategy: \'hoist\',',
    '  },',
    '})',
    '',
  ].join('\n'), 'utf8')

  await fs.writeFile(path.join(srcRoot, 'app.vue'), [
    '<script setup lang="ts">',
    'defineAppJson({',
    '  pages: [',
    '    \'pages/index/index\',',
    '  ],',
    '})',
    '</script>',
    '',
  ].join('\n'), 'utf8')

  await fs.writeFile(path.join(srcRoot, 'shared', 'layout.ts'), [
    'export const layoutShared = \'LAYOUT-SHARED-MARKER\'',
    'export function readLayoutShared() {',
    '  return layoutShared',
    '}',
    '',
  ].join('\n'), 'utf8')

  await fs.writeFile(path.join(srcRoot, 'layouts', 'default.vue'), [
    '<script setup lang="ts">',
    'import { readLayoutShared } from \'../shared/layout\'',
    'const title = readLayoutShared()',
    '</script>',
    '<template>',
    '  <view class="layout">',
    '    <view>{{ title }}</view>',
    '    <slot />',
    '  </view>',
    '</template>',
    '',
  ].join('\n'), 'utf8')

  await fs.writeFile(path.join(srcRoot, 'pages', 'index', 'index.vue'), [
    '<script setup lang="ts">',
    'import { readLayoutShared } from \'../../shared/layout\'',
    'definePageMeta({ layout: \'default\' })',
    'const message = readLayoutShared()',
    '</script>',
    '<template>',
    '  <view>{{ message }}</view>',
    '</template>',
    '',
  ].join('\n'), 'utf8')
}

async function writeScriptlessLayoutProjectFiles(root: string) {
  const srcRoot = path.join(root, 'src')
  await fs.mkdir(path.join(srcRoot, 'pages', 'index'), { recursive: true })
  await fs.mkdir(path.join(srcRoot, 'layouts'), { recursive: true })

  await writeJson(path.join(root, 'package.json'), {
    name: 'layout-build-scriptless-test',
    private: true,
    version: '0.0.0',
  })

  await linkWorkspaceWeappVitePackage(root)

  await writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx1234567890abce',
    compileType: 'miniprogram',
    miniprogramRoot: 'dist/',
    srcMiniprogramRoot: 'src/',
    setting: {},
  })

  await fs.writeFile(path.join(root, 'vite.config.ts'), [
    `import { defineConfig } from '${DEFINE_CONFIG_IMPORT}'`,
    '',
    'export default defineConfig({',
    '  weapp: {',
    '    srcRoot: \'src\',',
    '  },',
    '})',
    '',
  ].join('\n'), 'utf8')

  await fs.writeFile(path.join(srcRoot, 'app.vue'), [
    '<script setup lang="ts">',
    'defineAppJson({',
    '  pages: [',
    '    \'pages/index/index\',',
    '  ],',
    '})',
    '</script>',
    '',
  ].join('\n'), 'utf8')

  await fs.writeFile(path.join(srcRoot, 'layouts', 'default.vue'), [
    '<script setup lang="ts">',
    'defineComponentJson({',
    '  component: true,',
    '})',
    '</script>',
    '<template>',
    '  <view class="layout-default">',
    '    <slot />',
    '  </view>',
    '</template>',
    '',
  ].join('\n'), 'utf8')

  await fs.writeFile(path.join(srcRoot, 'pages', 'index', 'index.vue'), [
    '<script setup lang="ts">',
    'definePageMeta({ layout: \'default\' })',
    '</script>',
    '<template>',
    '  <view>hello</view>',
    '</template>',
    '',
  ].join('\n'), 'utf8')
}

describe('layout build regression', () => {
  afterAll(async () => {
    await Promise.all(tempRoots.map(root => fs.rm(root, { recursive: true, force: true })))
    tempRoots.length = 0
  })

  it('bundles vue layout shared imports into in-memory build outputs', async () => {
    const root = await createTempRoot()
    await writeProjectFiles(root)

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

    const layoutChunk = outputs.find(output => output.type === 'chunk' && output.fileName === 'layouts/default.js')
    const pageChunk = outputs.find(output => output.type === 'chunk' && output.fileName === 'pages/index/index.js')
    const sharedRuntimeChunk = outputs.find(output => output.type === 'chunk' && output.fileName === 'weapp-vendors/wevu-defineProperty.js')
    const sharedWevuChunk = outputs.find((output) => {
      return output.type === 'chunk'
        && output.fileName.endsWith('.js')
        && output.fileName !== 'layouts/default.js'
        && output.fileName !== 'pages/index/index.js'
        && output.fileName !== 'weapp-vendors/wevu-defineProperty.js'
        && output.code.includes('createWevuComponent')
    })
    const pageJson = outputs.find(output => output.type === 'asset' && output.fileName === 'pages/index/index.json')

    expect(layoutChunk).toBeTruthy()
    expect(pageChunk).toBeTruthy()
    expect(sharedRuntimeChunk).toBeTruthy()
    expect(sharedWevuChunk).toBeTruthy()
    expect(pageJson).toBeTruthy()

    expect(sharedRuntimeChunk!.code).toContain('LAYOUT-SHARED-MARKER')
    expect(sharedRuntimeChunk!.code).not.toContain('//#region src/layouts/default.vue')
    expect(sharedRuntimeChunk!.code).not.toContain('createWevuComponent({')
    expect(layoutChunk!.code).not.toContain('Component({})')
    expect(layoutChunk!.code).toContain('setup(')
    expect(layoutChunk!.imports).toContain('weapp-vendors/wevu-defineProperty.js')
    expect(layoutChunk!.imports).toContain(sharedWevuChunk!.fileName)
    expect(pageChunk!.imports).toContain('weapp-vendors/wevu-defineProperty.js')
    expect(pageChunk!.imports).toContain(sharedWevuChunk!.fileName)
    expect(sharedWevuChunk!.imports).toContain('weapp-vendors/wevu-defineProperty.js')
    expect(String(pageJson!.source)).toContain('"weapp-layout-default": "/layouts/default"')
  })

  it('emits a js stub for macro-only vue layouts', async () => {
    const root = await createTempRoot()
    await writeScriptlessLayoutProjectFiles(root)

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

    const layoutJs = outputs.find(output => output.fileName === 'layouts/default.js')
    const layoutJson = outputs.find(output => output.fileName === 'layouts/default.json')
    const layoutWxml = outputs.find(output => output.fileName === 'layouts/default.wxml')

    expect(layoutJs).toBeTruthy()
    expect(layoutJs!.type === 'asset' ? String(layoutJs.source).length : layoutJs.code.length).toBeGreaterThan(0)
    expect(layoutJson).toBeTruthy()
    expect(layoutWxml).toBeTruthy()
  })
})
