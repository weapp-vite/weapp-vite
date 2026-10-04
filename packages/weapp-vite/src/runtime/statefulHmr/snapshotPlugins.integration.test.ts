import type { OutputAsset, OutputChunk } from 'rolldown'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { expect, it } from 'vitest'
import { buildStatefulHmrSnapshot } from './snapshotBuild'

it('preserves native TypeScript and managed aliases across main and independent snapshot builds', async () => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-native-plugins-')))
  try {
    const files = {
      'package.json': JSON.stringify({ name: 'snapshot-native-plugins', private: true, type: 'module' }),
      'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
      'vite.config.ts': [
        `import { defineConfig } from ${JSON.stringify(path.resolve(import.meta.dirname, '../../config.ts'))}`,
        'export default defineConfig({ weapp: { srcRoot: "src", autoRoutes: false, vue: { enable: false }, npm: { enable: false }, typescript: { app: { compilerOptions: { paths: { "@/*": ["./src/*"] } } } }, subPackages: { isolated: { independent: true } } } })',
      ].join('\n'),
      'src/app.ts': 'import { label } from "@/shared/value"; interface AppData { label: string }; const data: AppData = { label }; App({ data })',
      'src/app.json': JSON.stringify({ pages: ['pages/index/index'], subPackages: [{ root: 'isolated', pages: ['index'], independent: true }] }),
      'src/shared/value.ts': 'export const label: string = "shared-alias-value"',
      'src/pages/index/index.ts': 'import { label } from "@/shared/value"; Page({ data: { label, scope: "main-page" } })',
      'src/pages/index/index.json': '{}',
      'src/pages/index/index.wxml': '<view>{{label}}</view>',
      'src/pages/index/index.wxss': '.page { color: red; }',
      'src/isolated/index.ts': 'import { label } from "@/shared/value"; interface State { label: string }; const state: State = { label }; Page({ data: { ...state, scope: "isolated-page" } })',
      'src/isolated/index.json': '{}',
      'src/isolated/index.wxml': '<view>{{label}}</view>',
      'src/isolated/index.wxss': '.page { color: blue; }',
    }
    for (const [relative, contents] of Object.entries(files)) {
      const file = path.join(root, relative)
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.writeFile(file, contents)
    }
    await fs.mkdir(path.join(root, 'node_modules'))
    await fs.symlink(path.resolve(import.meta.dirname, '../../..'), path.join(root, 'node_modules/weapp-vite'), 'junction')

    const snapshot = await buildStatefulHmrSnapshot({ cwd: root, isDev: true, mode: 'development' })
    const outputs: Array<OutputAsset | OutputChunk> = Array.isArray(snapshot.output)
      ? snapshot.output.flatMap(item => item.output)
      : 'output' in snapshot.output ? snapshot.output.output : []
    expect(new Set(outputs.map(item => item.fileName)).size).toBe(outputs.length)
    expect(outputs.map(item => item.fileName)).toEqual(expect.arrayContaining([
      'app.json',
      'app.js',
      ...['js', 'json', 'wxml', 'wxss'].flatMap(extension => [
        `pages/index/index.${extension}`,
        `isolated/index.${extension}`,
      ]),
    ]))
    const scripts = outputs.filter(item => item.fileName.endsWith('.js'))
      .map(item => item.type === 'chunk' ? item.code : String(item.source))
      .join('\n')
    expect(scripts).toContain('shared-alias-value')
    expect(scripts).toContain('main-page')
    expect(scripts).toContain('isolated-page')
    expect(scripts).not.toContain('interface AppData')
    expect(scripts).not.toContain('interface State')
    expect(scripts).not.toContain('@/shared/value')
    await expect(fs.access(path.join(root, 'dist'))).rejects.toThrow()
  }
  finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
