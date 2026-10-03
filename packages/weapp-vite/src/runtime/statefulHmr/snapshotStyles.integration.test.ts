import type { OutputAsset, OutputChunk } from 'rolldown'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { buildStatefulHmrSnapshot } from './snapshotBuild'

const temporaryRoots: string[] = []

async function createProject() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-snapshot-styles-'))
  temporaryRoots.push(root)
  const files = {
    'package.json': JSON.stringify({ name: 'snapshot-styles-regression', private: true, type: 'module' }),
    'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
    'vite.config.ts': [
      `import { defineConfig } from ${JSON.stringify(path.resolve(import.meta.dirname, '../../config.ts'))}`,
      'export default defineConfig({ weapp: { srcRoot: "src", autoRoutes: false, vue: { enable: false }, subPackages: { isolated: { independent: true, styles: ["theme.wxss"] } } } })',
    ].join('\n'),
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/index/index'], subPackages: [{ root: 'isolated', pages: ['index', 'pages/index/index'], independent: true }] }),
    'src/pages/index/index.ts': 'Page({})',
    'src/pages/index/index.json': '{}',
    'src/pages/index/index.wxml': '<view>initial-template</view>',
    'src/isolated/index.ts': 'Page({})',
    'src/isolated/index.json': '{}',
    'src/isolated/index.wxml': '<view class="shared-style">independent-entry-page</view>',
    'src/isolated/pages/index/index.ts': 'Page({})',
    'src/isolated/pages/index/index.json': '{}',
    'src/isolated/pages/index/index.wxml': '<view class="shared-style">independent-page</view>',
    'src/isolated/index.wxss': '.shared-style { color: red; }',
    'src/isolated/theme.wxss': '.theme { color: green; }',
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

function readAsset(outputs: Array<OutputChunk | OutputAsset>, filename: string) {
  const assets = outputs.filter(item => item.fileName === filename)
  expect(assets).toHaveLength(1)
  expect(assets[0]?.type).toBe('asset')
  return String((assets[0] as OutputAsset).source)
}

describe('stateful snapshot independent styles', () => {
  it('publishes each child style once across template and shared-style snapshots', async () => {
    const root = await createProject()
    const snapshot = async () => {
      const result = await buildStatefulHmrSnapshot({ cwd: root, isDev: true, mode: 'development' })
      const outputs = Array.isArray(result.output) ? result.output.flatMap(item => item.output) : 'output' in result.output ? result.output.output : []
      expect(new Set(outputs.map(item => item.fileName)).size).toBe(outputs.length)
      expect(outputs.map(item => item.fileName)).toEqual(expect.arrayContaining([
        'isolated/pages/index/index.js',
        'isolated/pages/index/index.json',
        'isolated/pages/index/index.wxml',
      ]))
      expect(readAsset(outputs, 'isolated/pages/index/index.wxss')).toContain('@import \'../../index.wxss\'')
      return outputs
    }

    const initial = await snapshot()
    expect(readAsset(initial, 'isolated/index.wxss')).toContain('@import \'./theme.wxss\'')
    expect(readAsset(initial, 'isolated/index.wxss')).toContain('red')
    expect(readAsset(initial, 'pages/index/index.wxml')).toContain('initial-template')

    await fs.writeFile(path.join(root, 'src/isolated/index.wxss'), '.shared-style { color: blue; }')
    await fs.writeFile(path.join(root, 'src/pages/index/index.wxml'), '<view>updated-template</view>')
    const updated = await snapshot()
    expect(readAsset(updated, 'isolated/index.wxss')).toContain('blue')
    expect(readAsset(updated, 'pages/index/index.wxml')).toContain('updated-template')
  })
})

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})
