import type { OutputAsset, OutputChunk } from 'rolldown'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { expect, it } from 'vitest'
import { createCompilerContextInstance } from '../../context/createCompilerContextInstance'
import { compilerSourceId, getCompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { buildStatefulHmrSnapshot } from './snapshotBuild'

it('retains nested native directory entries and their assets in fixed-source snapshots', async () => {
  const root = path.normalize(await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-directory-component-'))))
  const files = {
    'package.json': JSON.stringify({ name: 'snapshot-directory-component', private: true }),
    'project.config.json': JSON.stringify({ appid: 'wx1234567890abcd', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
    'vite.config.ts': `import { defineConfig } from ${JSON.stringify(path.resolve(import.meta.dirname, '../../config.ts'))}; export default defineConfig({ weapp: { srcRoot: 'src' } })`,
    'src/app.js': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
    'src/pages/index/index.js': 'Page({})',
    'src/pages/index/index.json': JSON.stringify({ usingComponents: { parent: '/components/parent' } }),
    'src/pages/index/index.wxml': '<parent />',
    'src/pages/index/index.wxss': '.page { color: red; }',
    'src/components/parent/index.js': 'Component({})',
    'src/components/parent/index.json': JSON.stringify({ component: true, usingComponents: { leaf: '../leaf' } }),
    'src/components/parent/index.wxml': '<view><leaf /></view>',
    'src/components/leaf/index.js': 'Component({ data: { marker: "NESTED-DIRECTORY-LEAF" } })',
    'src/components/leaf/index.json': JSON.stringify({ component: true }),
    'src/components/leaf/index.wxml': '<text>{{marker}}</text>',
    'src/components/leaf/index.wxss': 'text { color: green; }',
  }
  try {
    for (const [relative, source] of Object.entries(files)) {
      const file = path.join(root, relative)
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.writeFile(file, source)
    }
    const options = { cwd: root, isDev: true, mode: 'development' }
    const initial = await buildStatefulHmrSnapshot(options)
    const owner = createCompilerContextInstance()
    const host = getCompilerHmrHost(owner)
    for (const [relative, source] of Object.entries(files)) {
      if (relative.startsWith('src/')) {
        host.seed(path.join(root, relative), source)
      }
    }
    const style = path.join(root, 'src/pages/index/index.wxss')
    const changed = '.page { color: blue; }'
    await fs.writeFile(style, changed)
    host.capture(style, changed)
    const refreshed = await buildStatefulHmrSnapshot(options, undefined, owner, host.freeze([style]).sources)
    expect([...refreshed.getEntryIds()].sort()).toEqual([...initial.getEntryIds()].sort())
    expect([...refreshed.getEntryIds()]).toContain(compilerSourceId(path.join(root, 'src/components/leaf/index.js')))
    const result = refreshed.output
    const output = (Array.isArray(result) ? result.flatMap(item => item.output) : 'output' in result ? result.output : []) as Array<OutputAsset | OutputChunk>
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      expect(output.some(item => item.fileName === `components/leaf/index.${extension}`)).toBe(true)
    }
    const script = output.find(item => item.fileName === 'components/leaf/index.js') as OutputChunk
    expect(script.code).toContain('NESTED-DIRECTORY-LEAF')
    const pageStyle = output.find(item => item.fileName === 'pages/index/index.wxss') as OutputAsset
    expect(String(pageStyle.source)).toContain('blue')
  }
  finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
