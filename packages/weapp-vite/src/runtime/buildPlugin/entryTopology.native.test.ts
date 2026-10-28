import type { RolldownOutput } from 'rolldown'
import type { Plugin } from 'vite'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { CompilerSession } from '../compilerSession'

it('uses the buildStart page graph when app configuration changes after options during a full scan', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-entry-topology-')))
  const session = new CompilerSession()
  const appJson = path.join(root, 'src', 'app.json')
  const first = 'pages/first/index'
  const removed = 'pages/removed/index'
  const added = 'pages/added/index'
  const before = { pages: [first, removed] }
  const after = { pages: [first, added] }
  let observedInput: unknown
  const barrier: Plugin = {
    name: 'entry-topology-options-barrier',
    options: {
      order: 'post',
      handler(options) {
        observedInput = options.input
      },
    },
    buildStart: {
      order: 'pre',
      sequential: true,
      async handler() {
        // 确定性推进 options 与 buildStart 之间的保存，不依赖 watcher 调度或固定等待。
        expect(session.context.runtimeState.build.hmr.fullEntryScan).toBe(true)
        expect(JSON.parse(await readFile(appJson, 'utf8'))).toEqual(before)
        await writeFile(appJson, JSON.stringify(after))
      },
    },
  }
  try {
    const files: Record<string, string> = {
      'package.json': JSON.stringify({ name: 'entry-topology-native', private: true, type: 'module' }),
      'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
      'src/app.js': 'App({})',
      'src/app.json': JSON.stringify(before),
    }
    for (const page of [first, removed, added]) {
      files[`src/${page}.js`] = `Page({ data: { marker: ${JSON.stringify(page)} } })`
      files[`src/${page}.json`] = '{}'
      files[`src/${page}.wxml`] = `<view>${page}</view>`
    }
    for (const [file, content] of Object.entries(files)) {
      const target = path.join(root, file)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, content)
    }
    await mkdir(path.join(root, 'node_modules'))
    await symlink(await realpath(path.resolve(import.meta.dirname, '../../..')), path.join(root, 'node_modules', 'weapp-vite'), 'junction')
    const ctx = await session.initialize({
      cwd: root,
      isDev: false,
      mode: 'production',
      inlineConfig: {
        configFile: false,
        logLevel: 'silent',
        plugins: [barrier],
        weapp: { srcRoot: 'src', autoRoutes: false },
        build: { write: false, minify: false },
      },
    })
    ctx.runtimeState.build.hmr.fullEntryScan = true
    const result = await session.run(() => ctx.buildService.build({ skipNpm: true })) as RolldownOutput | RolldownOutput[]
    const outputs = (Array.isArray(result) ? result : [result]).flatMap(item => item.output)
    const names = outputs.map(output => output.fileName)
    const config = outputs.find(output => output.fileName === 'app.json')
    expect(config?.type).toBe('asset')
    expect(JSON.parse(String(config?.type === 'asset' ? config.source : ''))).toMatchObject(after)
    for (const extension of ['js', 'json', 'wxml']) {
      expect(names).toContain(`${first}.${extension}`)
      expect(names).toContain(`${added}.${extension}`)
      expect(names).not.toContain(`${removed}.${extension}`)
    }
    expect(Object.keys(observedInput as object)).toEqual(['app'])
  }
  finally {
    await session.close()
    await rm(root, { recursive: true, force: true })
  }
})
