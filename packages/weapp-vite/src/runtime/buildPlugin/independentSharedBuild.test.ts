import type { OutputAsset, OutputChunk } from 'rolldown'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { createCompilerContext } from '../../createContext'

const temporaryRoots: string[] = []

async function createProject() {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-independent-shared-'))
  temporaryRoots.push(temporaryRoot)
  const root = path.join(temporaryRoot, 'project')
  const files = {
    'package.json': JSON.stringify({ name: 'independent-shared-regression', private: true }),
    'project.config.json': JSON.stringify({
      appid: 'wx1234567890abcd',
      compileType: 'miniprogram',
      miniprogramRoot: 'dist/',
      srcMiniprogramRoot: 'src/',
      setting: {},
    }),
    'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2020', module: 'ESNext', moduleResolution: 'Bundler', skipLibCheck: true } }),
    'vite.config.ts': [
      `import { defineConfig } from ${JSON.stringify(path.resolve(import.meta.dirname, '../../config.ts'))}`,
      'export default defineConfig({ weapp: { srcRoot: "src", autoImportComponents: true, subPackages: { packageB: { independent: true } } } })',
    ].join('\n'),
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/index/index'], subPackages: [{ root: 'packageB', pages: ['pages/index/index'], independent: true }] }),
    'src/shared/message.ts': 'export const message = "SHARED-COMPONENT-CONTENT"',
    'src/components/SharedCard.vue': [
      '<script setup lang="ts">',
      'import { message } from "../shared/message"',
      '</script>',
      '<template><view class="shared-card">{{ message }}</view></template>',
      '<style>.shared-card { color: red; }</style>',
    ].join('\n'),
    'src/layouts/default.vue': [
      '<script setup lang="ts">',
      'import { message } from "../shared/message"',
      '</script>',
      '<template><view class="shared-layout"><text>{{ message }}</text><slot /></view></template>',
      '<style>.shared-layout { padding: 2px; }</style>',
    ].join('\n'),
    'src/pages/index/index.vue': [
      '<script setup lang="ts">',
      'import SharedCard from "../../components/SharedCard.vue"',
      'definePageMeta({ layout: "default" })',
      '</script>',
      '<template><SharedCard /></template>',
    ].join('\n'),
    'src/packageB/components/SharedCard.vue': '<template><view>LOCAL-COMPONENT-CONTENT</view></template>',
    'src/packageB/pages/index/index.vue': [
      '<script setup lang="ts">',
      'import SharedCard from "../../../components/SharedCard.vue"',
      'import LocalCard from "../../components/SharedCard.vue"',
      'definePageMeta({ layout: "default" })',
      '</script>',
      '<template><SharedCard /><LocalCard /></template>',
    ].join('\n'),
  }
  for (const [relative, content] of Object.entries(files)) {
    const filename = path.join(root, relative)
    await fs.mkdir(path.dirname(filename), { recursive: true })
    await fs.writeFile(filename, content)
  }
  await fs.mkdir(path.join(root, 'node_modules'), { recursive: true })
  await fs.symlink(path.resolve(import.meta.dirname, '../../..'), path.join(root, 'node_modules/weapp-vite'), 'dir')
  const workspace = path.join(temporaryRoot, 'workspace')
  await fs.symlink(root, workspace, 'junction')
  return workspace
}

function readOutput(outputs: Array<OutputChunk | OutputAsset>, fileName: string) {
  const output = outputs.find(output => output.fileName === fileName)
  expect(output, fileName).toBeDefined()
  return output!.type === 'chunk' ? output!.code : String(output!.source)
}

describe('independent shared component output ownership', () => {
  afterEach(async () => {
    await Promise.all(temporaryRoots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
  })

  it('keeps main and independent components, layouts and their imports in separate output roots', async () => {
    const root = await createProject()
    const ctx = await createCompilerContext({
      cwd: root,
      isDev: false,
      mode: 'production',
      inlineConfig: { build: { write: false } },
    })
    const result = await ctx.buildService.build()
    const outputs = Array.isArray(result) ? result.flatMap(item => item.output) : result.output
    const names = outputs.map(output => output.fileName)
    expect(new Set(names).size).toBe(names.length)
    for (const entry of ['components/SharedCard', 'layouts/default']) {
      for (const extension of ['js', 'json', 'wxml', 'wxss']) {
        expect(names).toContain(`${entry}.${extension}`)
        expect(names).toContain(`packageB/weapp-shared/${entry}.${extension}`)
      }
    }
    expect(readOutput(outputs, 'packageB/components/SharedCard.wxml')).toContain('LOCAL-COMPONENT-CONTENT')
    expect(readOutput(outputs, 'packageB/pages/index/index.wxml')).toContain('<weapp-layout-default')

    const mainJson = JSON.parse(readOutput(outputs, 'pages/index/index.json')) as { usingComponents: Record<string, string> }
    const childJson = JSON.parse(readOutput(outputs, 'packageB/pages/index/index.json')) as { usingComponents: Record<string, string> }
    expect(Object.values(mainJson.usingComponents)).toEqual(expect.arrayContaining(['/components/SharedCard', '/layouts/default']))
    expect(Object.values(childJson.usingComponents)).toEqual(expect.arrayContaining([
      '/packageB/weapp-shared/components/SharedCard',
      '/packageB/weapp-shared/layouts/default',
      '/packageB/components/SharedCard',
    ]))

    const independent = ctx.runtimeState.build.independent.outputs.get('packageB')
    expect(independent).toBeDefined()
    expect(independent!.output.every(output => output.fileName.startsWith('packageB/'))).toBe(true)
    for (const output of independent!.output) {
      if (output.type === 'chunk') {
        expect([...output.imports, ...output.dynamicImports].every(fileName => fileName.startsWith('packageB/'))).toBe(true)
      }
    }
    for (const output of outputs) {
      if (output.type === 'chunk' && !output.fileName.startsWith('packageB/')) {
        expect([...output.imports, ...output.dynamicImports].some(fileName => fileName.startsWith('packageB/'))).toBe(false)
      }
    }
  })
})
