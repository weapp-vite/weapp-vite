import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { createHeadlessSession } from '../../../../mpcore/packages/simulator/src/runtime'
import { createCompilerContextInstance } from '../../src/context/createCompilerContextInstance'
import { collectVueStyleScriptChanges } from '../../src/plugins/core/lifecycle/vueStyleDependency'
import { invalidateFileCache } from '../../src/plugins/utils/cache'
import { withVueStyleDependencySnapshot } from '../../src/runtime/buildPlugin/vueStyleSnapshot'
import { createSharedBuildConfig } from '../../src/runtime/sharedBuildConfig'

it.each([
  { interleave: true, component: false },
  { interleave: false, component: false },
  { interleave: true, component: true },
])('publishes matching external CSS bindings (interleave=$interleave, component=$component)', async ({ interleave, component }) => {
  const project = await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-source-interleave-')))
  const repo = path.resolve(import.meta.dirname, '../../../..')
  const source = '<script setup>const themeColor = "red"</script>\n<template><view class="target">same</view></template>\n<style src="./external.css" />'
  const target = component ? 'components/target/index' : 'pages/index/index'
  const style = `${path.dirname(target)}/external.css`
  const files: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'source-interleave', private: true, dependencies: { wevu: '*' } }),
    'project.config.json': JSON.stringify({ appid: 'wx1234567890abcd', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
    'vite.config.ts': `import { defineConfig } from ${JSON.stringify(path.join(repo, 'packages/weapp-vite/src/config.ts'))}; export default defineConfig({ weapp: { srcRoot: "src", hmr: { runtime: "classic" } } })`,
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
    [`src/${target}.vue`]: source,
    [`src/${style}`]: '.target { color: black; --generation: removal; }',
    ...(component
      ? {
          'src/pages/index/index.js': 'Page({})',
          'src/pages/index/index.wxml': '<test-target />',
          'src/pages/index/index.json': JSON.stringify({ usingComponents: { 'test-target': '/components/target/index' } }),
        }
      : {}),
  }
  const ctx = createCompilerContextInstance()
  try {
    for (const [name, content] of Object.entries(files)) {
      const file = path.join(project, name)
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(file, content)
    }
    await mkdir(path.join(project, 'node_modules'))
    await symlink(path.join(repo, 'packages-runtime/wevu'), path.join(project, 'node_modules/wevu'), 'junction')
    await symlink(path.join(repo, 'packages/weapp-vite'), path.join(project, 'node_modules/weapp-vite'), 'junction')
    ctx.currentBuildTarget = 'app'
    await ctx.configService.load({ cwd: project, isDev: true, mode: 'development' })
    await ctx.scanService.loadAppEntry()
    ctx.scanService.loadSubPackages()
    const options = ctx.configService.merge(undefined, createSharedBuildConfig(ctx.configService, ctx.scanService))
    options.build = { ...options.build, watch: undefined, write: true, emptyOutDir: false }
    await build(options)
    const entry = path.join(project, `src/${target}.vue`).replaceAll('\\', '/')
    const css = path.join(project, `src/${style}`).replaceAll('\\', '/')
    const output = (ext: string) => readFile(path.join(project, `dist/${target}.${ext}`), 'utf8')
    const initial = { js: await output('js'), wxml: await output('wxml'), wxss: await output('wxss') }
    const restored = '.target { color: v-bind(themeColor); --generation: restored; }'
    if (!interleave) {
      await writeFile(css, restored)
    }
    let pending = [css]
    let builds = 0
    const resolver = { resolve: async (id: string, importer: string) => ({ id: path.resolve(path.dirname(importer), id) }) }
    while (pending.length) {
      expect(builds).toBeLessThan(2)
      for (const file of pending) {
        ctx.moduleGraphService.recordChangedFile(file, 'update')
        invalidateFileCache(file)
      }
      ctx.moduleGraphService.bindPluginContext(resolver, resolver)
      const batch = pending
      pending = []
      await withVueStyleDependencySnapshot(ctx, [entry], batch, async () => {
        const scriptChanges = await collectVueStyleScriptChanges(ctx, css, ctx.configService)
        expect(scriptChanges.size).toBe(interleave && builds === 0 ? 0 : 1)
        const hmr = ctx.runtimeState.build.hmr
        hmr.dirtyEntrySet.add(entry)
        hmr.dirtyEntryReasons.set(entry, scriptChanges.has(entry) ? 'direct' : 'metadata')
        hmr.loadedEntrySet.delete(entry)
        hmr.dirtyVueEntryIds.add(entry)
        hmr.profile = { event: 'update', file: css, dirtyReasonSummary: ['css-importer:1'] }
        // 固定屏障：分类已完成后才切换磁盘源码，不依赖定时或 watch 事件。
        if (interleave && builds === 0) {
          await writeFile(css, restored)
        }
        await build(options)
        ctx.moduleGraphService.bindPluginContext(resolver, resolver)
        if (interleave && builds === 0) {
          expect(await output('js')).toBe(initial.js)
          expect(await output('wxml')).toBe(initial.wxml)
          expect(await output('wxss')).toBe(initial.wxss)
        }
      }, (changes) => {
        pending.push(...changes.map(change => change.file))
      })
      builds++
    }
    expect(builds).toBe(interleave ? 2 : 1)
    const current = { js: await output('js'), wxml: await output('wxml'), wxss: await output('wxss') }
    const session = createHeadlessSession({ projectPath: project })
    let rendered: string
    try {
      session.reLaunch('/pages/index/index')
      rendered = session.renderCurrentPage().wxml
    }
    finally {
      session.close()
    }
    expect(current.wxss).toContain('restored')
    expect(rendered).toContain('red')
    expect(current.js).not.toBe(initial.js)
    expect(current.wxml).not.toBe(initial.wxml)
  }
  finally {
    ctx.moduleGraphService.resetSession()
    await rm(project, { recursive: true, force: true })
  }
})
