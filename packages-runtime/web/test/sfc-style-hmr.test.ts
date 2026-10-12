import type { ModuleNode } from 'vite'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { weappWebPlugin } from '../src/plugin'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

it('rescans an external app style and returns its owner and synthetic CSS to Vite HMR', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'web-app-style-hmr-'))
  directories.push(root)
  const app = path.join(root, 'src/app.vue').replaceAll('\\', '/')
  const style = path.join(root, 'theme.css').replaceAll('\\', '/')
  await mkdir(path.join(root, 'src/pages/index'), { recursive: true })
  await writeFile(app, '<script setup>defineAppJson({ pages: ["pages/index/index"] })</script><style src="../theme.css"></style>')
  await writeFile(path.join(root, 'src/pages/index/index.vue'), '<template><view>page</view></template>')
  await writeFile(style, '.probe { color: red; }')
  const plugin = weappWebPlugin()
  const context = { addWatchFile: vi.fn() }
  await plugin.configResolved!.call(context, { root, command: 'serve' })
  // 本用例只观察模块身份，完整 Vite 节点契约由类型测试和宿主集成测试覆盖。
  const ownerModule = { id: app } as ModuleNode
  const syntheticStyle = `${app}.css?weapp-web-sfc-style&inline`
  const styleModule = { id: syntheticStyle } as ModuleNode
  const graph = new Map([[app, new Set([ownerModule])], [`${app}.css`, new Set([styleModule])]])
  const invalidateModule = vi.fn()
  plugin.configureServer!({
    middlewares: { use: vi.fn() },
    moduleGraph: { getModuleById: () => undefined, getModulesByFile: file => graph.get(file), invalidateModule },
  })
  expect(await plugin.load!.call(context, syntheticStyle)).toContain('red')
  expect(context.addWatchFile).toHaveBeenCalledWith(style)
  await writeFile(style, '.probe { color: blue; }')
  expect(await plugin.handleHotUpdate!.call(context, { file: style, modules: [] })).toEqual([ownerModule, styleModule])
  expect(invalidateModule).toHaveBeenCalledWith(styleModule)
  expect(await plugin.load!.call(context, syntheticStyle)).toContain('blue')
})
