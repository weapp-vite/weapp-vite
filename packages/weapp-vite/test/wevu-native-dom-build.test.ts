import type { InlineConfig } from 'vite'
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { weapp } from '../src/vite'

it('通过 Vite 构建 TT auto 的 SFC 与 legacy 回退模板，非 TT auto 不携带原生后端', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'wevu-native-build-'))
  try {
    const files = {
      'package.json': '{"name":"native-dom-fixture","private":true,"type":"module","dependencies":{"wevu":"workspace:*"}}',
      'project.config.json': '{"miniprogramRoot":"dist/","compileType":"miniprogram"}',
      'src/app.ts': 'App({})',
      'src/app.json': '{"pages":["pages/index/index"]}',
      'src/pages/index/index.vue': '<script setup>import { ref } from "wevu"; import Child from "../../components/Child.vue"; const count = ref(0)</script><template><view><Child :value="count"/><button @tap="count++">add</button></view></template>',
      'src/components/Child.vue': '<script setup>defineProps({ value: Number })</script><template><text>{{ value }}</text></template>',
    }
    for (const [filename, source] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(root, filename)), { recursive: true })
      await writeFile(path.join(root, filename), source)
    }
    const target = path.join(root, 'node_modules/wevu')
    await mkdir(path.dirname(target), { recursive: true })
    await symlink(await realpath(path.resolve(import.meta.dirname, '../../../packages-runtime/wevu')), target, 'junction')
    const config: InlineConfig = {
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      weapp: { platform: 'tt', srcRoot: 'src', npm: { enable: false }, wevu: { renderer: 'auto' }, hmr: { runtime: 'classic' } },
      build: { minify: true },
    }
    await build(config)
    const read = (filename: string) => readFile(path.join(root, 'dist', filename), 'utf8')
    expect(await read('pages/index/index.ttml')).toContain('tt:if="{{__wevuLegacyRenderer}}"')
    expect(JSON.parse(await read('app.json')).pages).toEqual(['pages/index/index'])
    await Promise.all(['js', 'json', 'ttml'].map(extension => read(`pages/index/index.${extension}`)))
    const scripts = async () => {
      const entries = await readdir(path.join(root, 'dist'), { recursive: true })
      return (await Promise.all(entries.filter(file => file.endsWith('.js')).map(read))).join('\n')
    }
    expect(await scripts()).toContain('getPageDocumentById')
    expect(await scripts()).not.toMatch(/\b__VUE_OPTIONS_API__\b|\beval\s*\(|new Function\b/)
    await build({ ...config, plugins: [weapp()], weapp: { ...config.weapp, platform: 'weapp' } })
    expect(await read('pages/index/index.wxml')).not.toContain('__wevuLegacyRenderer')
    expect(await scripts()).not.toContain('getPageDocumentById')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}, 60_000)
