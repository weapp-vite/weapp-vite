import type { RolldownWatcher } from 'rolldown'
import type { InlineConfig } from 'vite'
import { access, cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build, createServer } from 'vite'
import { afterEach, expect, it } from 'vitest'
import { weapp } from '../src/vite'

const roots: string[] = []
const fixtureRoot = path.resolve(import.meta.dirname, '../../../e2e-apps/react-runtime-spike')
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(srcRoot = 'src') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-react-host-'))
  roots.push(root)
  for (const file of ['src', 'package.json', 'project.config.json', 'project.private.config.json']) {
    await cp(path.join(fixtureRoot, file), path.join(root, file === 'src' ? srcRoot : file), { recursive: true })
  }
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>
  }
  // Windows 整目录 junction 会破坏包内的相对 workspace 链接，逐依赖保留真实目标。
  for (const name of Object.keys(manifest.dependencies)) {
    const target = path.join(root, 'node_modules', name)
    await mkdir(path.dirname(target), { recursive: true })
    await symlink(await realpath(path.join(fixtureRoot, 'node_modules', name)), target, 'junction')
  }
  // 先验证夹具入口可读，不把缺失依赖伪装成 Vite/React 转换失败。
  await access(path.join(root, 'node_modules/@weapp-vite/react/dist/index.mjs'))
  const config: InlineConfig = {
    root,
    configFile: false,
    plugins: [weapp()],
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    weapp: { srcRoot, npm: { enable: false }, react: { compiler: false, renderMode: 'auto', devWarnings: false }, hmr: { runtime: 'classic' } },
    build: { minify: true },
    server: { middlewareMode: true },
  }
  const read = (file: string) => readFile(path.join(root, 'dist', file), 'utf8')
  return { root, config, read }
}

it.each(['src', 'miniprogram'])('builds mixed React pages and native/Wevu bridges from %s', async (srcRoot) => {
  const { config, read } = await fixture(srcRoot)
  await build(config)
  expect(JSON.parse(await read('app.json')).pages).toEqual(expect.arrayContaining(['pages/index/index', 'pages/static/index', 'pages/interop/index']))
  expect(await read('pages/static/index.wxml')).toContain('weapp-vite React static bindings')
  expect(await read('runtime/base.wxml')).toContain('react_root')
  expect(JSON.parse(await read('pages/interop/index.json')).usingComponents).toBeDefined()
  expect(await read('pages/static/index.js')).not.toContain('/@vite/client')
}, 30_000)

it('refreshes React templates through native production watch', async () => {
  const { root, config, read } = await fixture()
  const watcher = await build({ ...config, build: { ...config.build, watch: {} } }) as RolldownWatcher
  let rounds = 0
  watcher.on('event', (event) => {
    if (event.code === 'BUNDLE_END') {
      rounds++
    }
  })
  try {
    await expect.poll(() => rounds, { timeout: 15_000 }).toBeGreaterThan(0)
    expect(await read('pages/static/index.wxml')).toContain('weapp-vite React static bindings')
    const file = path.join(root, 'src/pages/static/view.tsx')
    await writeFile(file, (await readFile(file, 'utf8')).replace('weapp-vite React static bindings', 'watched React template'))
    await expect.poll(() => rounds, { timeout: 15_000 }).toBeGreaterThan(1)
    expect(await read('pages/static/index.wxml')).toContain('watched React template')
  }
  finally {
    await watcher.close()
  }
}, 30_000)

it.each(['classic', 'stateful-experimental'] as const)('updates a React static template through %s and releases the host', async (runtime) => {
  const { root, config, read } = await fixture()
  config.weapp!.hmr = { runtime }
  const server = await createServer(config)
  try {
    expect(await read('pages/static/index.wxml')).toContain('weapp-vite React static bindings')
    const file = path.join(root, 'src/pages/static/view.tsx')
    const source = await readFile(file, 'utf8')
    await writeFile(file, source.replace('weapp-vite React static bindings', 'updated React host template'))
    await expect.poll(() => read('pages/static/index.wxml'), { timeout: 15_000 }).toContain('updated React host template')
  }
  finally {
    await server.close()
  }
}, 30_000)
