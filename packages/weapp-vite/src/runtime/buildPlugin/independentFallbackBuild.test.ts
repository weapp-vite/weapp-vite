import type { OutputAsset, OutputChunk } from 'rolldown'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, expect, it } from 'vitest'
import { createCompilerContext } from '../../createContext'

const roots: string[] = []

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-independent-fallback-'))
  roots.push(root)
  const mainPage = [
    '<script setup lang="ts">',
    'import MainCard from "../../components/MainCard.vue"',
    '</script>',
    '<template><MainCard /><view>MAIN-PAGE</view></template>',
    '<style>.main-page { color: red; }</style>',
  ].join('\n')
  const files = {
    'package.json': JSON.stringify({ name: 'independent-fallback-regression', private: true }),
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
      'export default defineConfig({ weapp: { srcRoot: "src", npm: { enable: false } } })',
    ].join('\n'),
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({
      pages: ['pages/main/index'],
      subPackages: [
        { root: 'ordinary', pages: ['pages/index'] },
        { root: 'independent', pages: ['index'], independent: true },
      ],
    }),
    'src/components/MainCard.vue': '<template><view>MAIN-CARD</view></template><style>view { color: blue; }</style>',
    'src/pages/main/index.vue': mainPage,
    'src/ordinary/pages/index.vue': '<template><view>ORDINARY-PAGE</view></template><style>view { color: green; }</style>',
    'src/independent/index.ts': 'Page({ data: { marker: "INDEPENDENT-NATIVE" } })',
    'src/independent/index.json': '{}',
    'src/independent/index.wxml': '<view>{{ marker }}</view>',
    'src/independent/index.wxss': 'view { color: black; }',
  }
  for (const [relative, content] of Object.entries(files)) {
    const filename = path.join(root, relative)
    await fs.mkdir(path.dirname(filename), { recursive: true })
    await fs.writeFile(filename, content)
  }
  await fs.mkdir(path.join(root, 'node_modules'), { recursive: true })
  await fs.symlink(path.resolve(import.meta.dirname, '../../..'), path.join(root, 'node_modules/weapp-vite'), 'junction')
  return root
}

function readOutput(outputs: Array<OutputChunk | OutputAsset>, fileName: string) {
  const output = outputs.find(output => output.fileName === fileName)
  expect(output, fileName).toBeDefined()
  return output!.type === 'chunk' ? output!.code : String(output!.source)
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

async function buildProject(root: string) {
  const ctx = await createCompilerContext({
    cwd: root,
    isDev: false,
    mode: 'production',
  })
  const result = await ctx.buildService.build()
  const outputs = Array.isArray(result) ? result.flatMap(item => item.output) : result.output
  return { ctx, outputs }
}

it('does not copy unrelated main Vue page assets into a native independent package across publications', async () => {
  const root = await fixture()
  // 第二轮使用新的独立编译上下文，必须依旧按源码注册表归属，不能把上一轮 app.json 的主页面复制进来。
  for (let generation = 0; generation < 2; generation++) {
    const { ctx, outputs } = await buildProject(root)
    const names = outputs.map(output => output.fileName)
    for (const entry of ['pages/main/index', 'components/MainCard', 'ordinary/pages/index', 'independent/index']) {
      for (const extension of ['js', 'json', 'wxml', 'wxss']) {
        const fileName = `${entry}.${extension}`
        expect(names).toContain(fileName)
        await expect(fs.access(path.join(root, 'dist', fileName))).resolves.toBeUndefined()
      }
    }
    expect(readOutput(outputs, 'pages/main/index.wxml')).toContain('MAIN-PAGE')
    expect(readOutput(outputs, 'components/MainCard.wxml')).toContain('MAIN-CARD')
    expect(readOutput(outputs, 'ordinary/pages/index.wxml')).toContain('ORDINARY-PAGE')
    expect(readOutput(outputs, 'independent/index.js')).toContain('INDEPENDENT-NATIVE')
    const mainJson = JSON.parse(readOutput(outputs, 'pages/main/index.json')) as { usingComponents: Record<string, string> }
    expect(Object.values(mainJson.usingComponents)).toContain('/components/MainCard')
    const independent = ctx.runtimeState.build.independent.outputs.get('independent')
    expect(independent).toBeDefined()
    expect(independent!.output.some(output => output.fileName.startsWith('independent/weapp-shared/pages/'))).toBe(false)
    expect(independent!.output.some(output => output.fileName.startsWith('independent/weapp-shared/components/MainCard'))).toBe(false)
    expect(names.some(name => name.startsWith('independent/weapp-shared/pages/'))).toBe(false)
    await expect(fs.access(path.join(root, 'dist/app.json'))).resolves.toBeUndefined()
  }
})
