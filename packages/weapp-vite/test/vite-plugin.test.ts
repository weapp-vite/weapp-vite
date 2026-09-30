import type { InlineConfig } from 'vite'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build, resolveConfig } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { weapp } from '../src/vite'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(name = 'home') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-host-'))
  roots.push(root)
  const files = {
    'package.json': JSON.stringify({ name: 'host-fixture', type: 'module' }),
    'project.config.json': JSON.stringify({ miniprogramRoot: 'dist' }),
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({ pages: [`pages/${name}/index`] }),
    [`src/pages/${name}/index.ts`]: `Page({data:{message:${JSON.stringify(name)}}})`,
    [`src/pages/${name}/index.json`]: '{}',
    [`src/pages/${name}/index.wxml`]: '<view>{{message}}</view>',
    [`src/pages/${name}/index.wxss`]: 'view { color: red; }',
  }
  for (const [file, source] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), source)
  }
  const config: InlineConfig = {
    root,
    configFile: false,
    plugins: [weapp()],
    logLevel: 'silent',
    weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false },
    build: { outDir: 'dist', minify: false },
  }
  return { root, config }
}

async function readOutput(root: string, file: string) {
  return readFile(path.join(root, 'dist', file), 'utf8')
}

describe('standard Vite plugin', () => {
  it('builds real mini-program entries without index.html and leaves the user plugin active', async () => {
    const { root, config } = await fixture()
    let transforms = 0
    config.plugins!.push({ name: 'consumer-transform', transform(code, id) {
      if (id.endsWith('/pages/home/index.ts')) {
        transforms++
        return code.replace('"home"', '"transformed"')
      }
    } })
    await build(config)
    expect(JSON.parse(await readOutput(root, 'app.json'))).toMatchObject({ pages: ['pages/home/index'] })
    expect(await readOutput(root, 'pages/home/index.js')).toContain('transformed')
    expect(await readOutput(root, 'pages/home/index.wxml')).toContain('{{message}}')
    expect(await readOutput(root, 'pages/home/index.wxss')).toContain('red')
    expect(JSON.parse(await readOutput(root, 'pages/home/index.json'))).toEqual({})
    expect(transforms).toBeGreaterThan(0)
    expect(await readdir(path.join(root, 'dist'))).not.toContain('index.html')
  })

  it('builds from a clean managed TypeScript project without a prior prepare command', async () => {
    const { root, config } = await fixture()
    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({
      references: [{ path: './.weapp-vite/tsconfig.app.json' }],
      files: [],
    }))
    expect(await readdir(root)).not.toContain('.weapp-vite')
    await build(config)
    expect(await readOutput(root, 'pages/home/index.js')).toContain('home')
    expect(JSON.parse(await readFile(path.join(root, '.weapp-vite/tsconfig.app.json'), 'utf8')).include).toContain('../src/**/*')
  })

  it('isolates concurrent projects, including mode=test production builds', async () => {
    const first = await fixture('first')
    const second = await fixture('second')
    first.config.mode = 'test'
    await Promise.all([build(first.config), build(second.config)])
    expect(JSON.parse(await readOutput(first.root, 'app.json')).pages).toEqual(['pages/first/index'])
    expect(JSON.parse(await readOutput(second.root, 'app.json')).pages).toEqual(['pages/second/index'])
  })

  it('does not discover or execute a second configuration file', async () => {
    const { root, config } = await fixture()
    await writeFile(path.join(root, 'weapp-vite.config.mjs'), 'throw new Error("must not load shadow config")')
    await build(config)
    expect(await readOutput(root, 'app.js')).toContain('App')
  })

  it('publishes native npm component files through the host bundle', async () => {
    const { root, config } = await fixture()
    await writeFile(path.join(root, 'package.json'), JSON.stringify({
      name: 'host-fixture',
      type: 'module',
      dependencies: { 'mini-card': '1.0.0' },
    }))
    const packageRoot = path.join(root, 'node_modules/mini-card')
    await mkdir(path.join(packageRoot, 'miniprogram'), { recursive: true })
    await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({
      name: 'mini-card',
      version: '1.0.0',
      main: 'miniprogram/index.js',
      miniprogram: 'miniprogram',
    }))
    for (const [extension, source] of Object.entries({
      js: 'Component({ properties: { title: String } })',
      json: '{"component":true}',
      wxml: '<view>{{title}}</view>',
      wxss: 'view { color: green; }',
    })) {
      await writeFile(path.join(packageRoot, `miniprogram/index.${extension}`), source)
    }
    const emitted: string[] = []
    config.plugins!.push({ name: 'observe-native-npm-publication', writeBundle(_options, bundle) {
      emitted.push(...Object.keys(bundle))
    } })
    await build(config)
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      expect(emitted).toContain(`miniprogram_npm/mini-card/index.${extension}`)
    }
    expect(await readOutput(root, 'miniprogram_npm/mini-card/index.js')).toContain('Component')
    expect(await readOutput(root, 'miniprogram_npm/mini-card/index.wxml')).toContain('{{title}}')
  })

  it('executes the host configuration once and removes obsolete outputs on a later build', async () => {
    const { root, config } = await fixture()
    const configFile = path.join(root, 'vite.config.mjs')
    await writeFile(configFile, `
import { appendFileSync } from 'node:fs'
appendFileSync(new URL('./config-calls.txt', import.meta.url), 'loaded\\n')
export default async () => ({ weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false } })
`)
    config.configFile = configFile
    await build(config)
    expect(await readFile(path.join(root, 'config-calls.txt'), 'utf8')).toBe('loaded\n')
    await mkdir(path.join(root, 'src/pages/next'), { recursive: true })
    await writeFile(path.join(root, 'src/pages/next/index.ts'), 'Page({})')
    await writeFile(path.join(root, 'src/pages/next/index.wxml'), '<view>next</view>')
    await writeFile(path.join(root, 'src/pages/next/index.json'), '{}')
    await rm(path.join(root, 'src/pages/home'), { recursive: true })
    await writeFile(path.join(root, 'src/app.json'), JSON.stringify({ pages: ['pages/next/index'] }))
    await build(config)
    expect(JSON.parse(await readOutput(root, 'app.json')).pages).toEqual(['pages/next/index'])
    expect(await readdir(path.join(root, 'dist/pages'))).toEqual(['next'])
    expect(await readFile(path.join(root, 'config-calls.txt'), 'utf8')).toBe('loaded\nloaded\n')
  })

  it('clears compiler hooks when a completed plugin is reused by Vitest', async () => {
    const { config } = await fixture()
    await build(config)
    config.plugins!.push({ name: 'vitest:config' })
    const resolved = await resolveConfig(config, 'serve')
    const context = resolved.plugins.find(plugin => plugin.name === 'weapp-vite:context')
    expect(context?.api).toBeUndefined()
    expect(resolved.weappVite).toBeUndefined()
    expect(resolved.plugins.find(plugin => plugin.name === 'weapp-vite:pre')?.transform).toBeUndefined()
  })

  it('builds Vue SFC pages and ordinary subpackages through the same host', async () => {
    const { root, config } = await fixture()
    config.weapp!.vue = { enable: true }
    await rm(path.join(root, 'src/pages/home/index.ts'))
    await writeFile(path.join(root, 'src/pages/home/index.vue'), `<script setup lang="ts">
const message: string = 'vue-host'
</script>
<template><view>{{ message }}</view></template>
<style>view { color: blue; }</style>`)
    await mkdir(path.join(root, 'src/extra/pages/detail'), { recursive: true })
    await writeFile(path.join(root, 'src/extra/pages/detail/index.vue'), '<template><view>subpackage-host</view></template>')
    await writeFile(path.join(root, 'src/app.json'), JSON.stringify({
      pages: ['pages/home/index'],
      subPackages: [{ root: 'extra', pages: ['pages/detail/index'] }],
    }))
    await build(config)
    expect(await readOutput(root, 'pages/home/index.js')).toContain('vue-host')
    expect(await readOutput(root, 'pages/home/index.wxml')).toContain('{{message}}')
    expect(await readOutput(root, 'extra/pages/detail/index.wxml')).toContain('subpackage-host')
    expect(JSON.parse(await readOutput(root, 'app.json')).subPackages).toEqual([{ root: 'extra', pages: ['pages/detail/index'] }])
  })

  it('rejects duplicate activation before writing outputs', async () => {
    const { root, config } = await fixture()
    config.plugins!.push(weapp())
    await expect(build(config)).rejects.toThrow('只能安装一次')
    expect(await readdir(root)).not.toContain('dist')
  })

  it('rejects concurrent hosts sharing a plugin before asynchronous initialization', async () => {
    const first = await fixture('first')
    const second = await fixture('second')
    const shared = weapp()
    first.config.plugins = [shared]
    second.config.plugins = [shared]
    const results = await Promise.allSettled([build(first.config), build(second.config)])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason as Error] : [])
    expect(errors).toHaveLength(1)
    expect(errors[0]?.message).toContain('活动宿主复用')
  })

  it.each(['web', 'worker'] as const)('rejects unsupported or incomplete %s before writing outputs', async (kind) => {
    const { root, config } = await fixture()
    if (kind === 'web') {
      config.weapp!.web = { enable: true }
    }
    if (kind === 'worker') {
      await writeFile(path.join(root, 'src/app.json'), JSON.stringify({ pages: ['pages/home/index'], workers: 'workers' }))
    }
    await expect(build(config)).rejects.toThrow(kind === 'worker' ? /worker.entry/ : /Web/)
    expect(await readdir(root)).not.toContain('dist')
  })

  it('keeps configuration inspection free of generated output', async () => {
    const { root, config } = await fixture()
    await resolveConfig(config, 'build')
    expect(await readdir(root)).not.toContain('dist')
    expect(await readdir(root)).not.toContain('.weapp-vite')
  })

  it('does not activate compilation for the Vitest host', async () => {
    const { root, config } = await fixture()
    config.plugins!.push({ name: 'vitest:config' })
    const resolved = await resolveConfig(config, 'serve')
    expect(resolved.weappVite).toBeUndefined()
    expect(await readdir(root)).not.toContain('dist')
    expect(await readdir(root)).not.toContain('.weapp-vite')
  })
})
