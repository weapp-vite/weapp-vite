import os from 'node:os'
import process from 'node:process'
import fs from 'fs-extra'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { createCompilerContext } from '../../createContext'

const tempRoots: string[] = []
const DEFINE_CONFIG_IMPORT = path.resolve(import.meta.dirname, '../../config.ts').replace(/\\/g, '/')

async function createTempRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-layout-build-'))
  tempRoots.push(root)
  return root
}

async function writeProjectFiles(root: string) {
  const srcRoot = path.join(root, 'src')
  await fs.ensureDir(path.join(srcRoot, 'pages', 'index'))
  await fs.ensureDir(path.join(srcRoot, 'layouts'))
  await fs.ensureDir(path.join(srcRoot, 'shared'))

  await fs.writeJson(path.join(root, 'package.json'), {
    name: 'layout-build-test',
    private: true,
    version: '0.0.0',
  }, { spaces: 2 })

  await fs.ensureSymlink(path.join(process.cwd(), 'node_modules'), path.join(root, 'node_modules'))

  await fs.writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx1234567890abcd',
    compileType: 'miniprogram',
    miniprogramRoot: 'dist/',
    srcMiniprogramRoot: 'src/',
    setting: {},
  }, { spaces: 2 })

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

describe('layout build regression', () => {
  afterAll(async () => {
    await Promise.all(tempRoots.map(root => fs.remove(root)))
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
    const commonChunk = outputs.find(output => output.type === 'chunk' && output.fileName === 'common.js')
    const pageJson = outputs.find(output => output.type === 'asset' && output.fileName === 'pages/index/index.json')

    expect(layoutChunk).toBeTruthy()
    expect(pageChunk).toBeTruthy()
    expect(commonChunk).toBeTruthy()
    expect(pageJson).toBeTruthy()

    expect(commonChunk!.code).toContain('LAYOUT-SHARED-MARKER')
    expect(layoutChunk!.imports).toContain('common.js')
    expect(pageChunk!.imports).toContain('common.js')
    expect(String(pageJson!.source)).toContain('"weapp-layout-default": "/layouts/default"')
  })
})
