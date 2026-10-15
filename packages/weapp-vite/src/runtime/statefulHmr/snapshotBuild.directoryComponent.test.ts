import type { OutputAsset, OutputChunk } from 'rolldown'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'pathe'
import { expect, it } from 'vitest'
import { createCompilerContextInstance } from '../../context/createCompilerContextInstance'
import { compilerSourceId, getCompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { buildStatefulHmrSnapshot } from './snapshotBuild'

it.each([false, true])('retains native directory assets and imported styles in fixed-source snapshots (tailwind=%s)', async (tailwind) => {
  const root = path.normalize(await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-directory-component-'))))
  const files = {
    'package.json': JSON.stringify({ name: 'snapshot-directory-component', private: true }),
    'project.config.json': JSON.stringify({ appid: 'wx1234567890abcd', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
    'project.private.config.json': JSON.stringify({ setting: { compileHotReLoad: true } }),
    'vite.config.ts': `import { defineConfig } from ${JSON.stringify(path.resolve(import.meta.dirname, '../../config.ts'))}; export default defineConfig({ weapp: { srcRoot: 'src', autoRoutes: false, hmr: { runtime: 'stateful-experimental' }, ${tailwind ? 'tailwindcss: { cssEntries: ["src/app.css"] }' : ''} } })`,
    'src/app.js': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/index/index', 'pages/imported/index'] }),
    'src/pages/index/index.js': 'Page({})',
    'src/pages/index/index.json': JSON.stringify({ usingComponents: { parent: '/components/parent' } }),
    'src/pages/index/index.wxml': '<parent />',
    'src/pages/index/index.wxss': '@import "../../styles/theme.wxss";\n.page { color: red; }',
    'src/styles/theme.wxss': '.theme { color: #123; }',
    'src/pages/imported/index.js': 'Page({ data: { marker: "IMPORTED" } })',
    'src/pages/imported/index.json': '{}',
    'src/pages/imported/index.wxml': '<view>{{marker}}</view>',
    'src/pages/imported/index.wxss': '@import "../../styles/theme.wxss";',
    'src/components/parent/index.js': 'Component({})',
    'src/components/parent/index.json': JSON.stringify({ component: true, usingComponents: { leaf: '../leaf' } }),
    'src/components/parent/index.wxml': '<view><leaf /></view>',
    'src/components/leaf/index.js': 'Component({ data: { marker: "NESTED-DIRECTORY-LEAF" } })',
    'src/components/leaf/index.json': JSON.stringify({ component: true }),
    'src/components/leaf/index.wxml': '<text>{{marker}}</text>',
    'src/components/leaf/index.wxss': 'text { color: green; }',
    ...(tailwind ? { 'src/app.css': '@import "tailwindcss"; @source "./**/*.{wxml,js}";' } : {}),
  }
  try {
    for (const [relative, source] of Object.entries(files)) {
      const file = path.join(root, relative)
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.writeFile(file, source)
    }
    if (tailwind) {
      await fs.mkdir(path.join(root, 'node_modules'))
      await fs.symlink(path.dirname(createRequire(import.meta.url).resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
    }
    const options = { cwd: root, isDev: true, mode: 'development' }
    const initial = await buildStatefulHmrSnapshot(options)
    const owner = createCompilerContextInstance()
    await owner.configService.load(options)
    const host = getCompilerHmrHost(owner)
    for (const [relative, source] of Object.entries(files)) {
      if (relative.startsWith('src/')) {
        host.seed(path.join(root, relative), source)
      }
    }
    const style = path.join(root, 'src/pages/index/index.wxss')
    const changed = '@import "../../styles/theme.wxss";\n.page { color: blue; }'
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
    expect(String(pageStyle.source)).toContain('#123')
    const importedStyle = output.find(item => item.fileName === 'pages/imported/index.wxss') as OutputAsset
    expect(String(importedStyle.source)).toContain('#123')
    const theme = path.join(root, 'src/styles/theme.wxss')
    for (const color of ['#456', '#123']) {
      const source = `.theme { color: ${color}; }`
      await fs.writeFile(theme, source)
      host.capture(theme, source)
      const snapshot = await buildStatefulHmrSnapshot(options, undefined, owner, host.freeze([theme]).sources)
      const result = snapshot.output
      const output = Array.isArray(result) ? result.flatMap(item => item.output) : 'output' in result ? result.output : []
      const stylesheet = output.find(item => item.fileName === 'pages/imported/index.wxss') as OutputAsset
      expect(String(stylesheet.source)).toContain(color)
      expect(String(stylesheet.source)).not.toContain('@import "../../styles/theme.wxss"')
    }
  }
  finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
