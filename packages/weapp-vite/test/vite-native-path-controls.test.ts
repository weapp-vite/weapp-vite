import { access, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build, createServer } from 'vite'
import { afterEach, expect, it } from 'vitest'

const fixtureRoot = path.resolve(import.meta.dirname, '../../../e2e-apps/react-runtime-spike')
const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

it('resolves React runtime with native Vite through linked packages', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'vite-react-resolution-'))
  roots.push(root)
  const manifest = JSON.parse(await readFile(path.join(fixtureRoot, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>
  }
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ type: 'module', dependencies: manifest.dependencies }))
  for (const name of Object.keys(manifest.dependencies)) {
    const target = path.join(root, 'node_modules', name)
    await mkdir(path.dirname(target), { recursive: true })
    await symlink(await realpath(path.join(fixtureRoot, 'node_modules', name)), target, 'junction')
  }
  await access(path.join(root, 'node_modules/@weapp-vite/react/dist/index.mjs'))
  const entry = path.join(root, 'index.ts')
  await writeFile(entry, 'export { createReactMiniProgramRoot } from "@weapp-vite/react"')
  // 不安装 weapp 插件，以区分原生宿主解析与小程序编译契约。
  const output = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { lib: { entry, formats: ['es'] }, write: false, minify: false },
  })
  const bundles = Array.isArray(output) ? output : [output]
  expect(bundles.flatMap(bundle => 'output' in bundle
    ? bundle.output.flatMap(file => file.type === 'chunk' ? file.exports : [])
    : [])).toContain('createReactMiniProgramRoot')
}, 30_000)

// 原始 fs.watch 启动对照保留在诊断脚本；门禁使用框架 watcher 的真实 ready 边界。
it('observes one native Vite file creation after readiness using the canonical temporary path', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'vite-native-watch-'))
  roots.push(root)
  const watchedRoot = await realpath(root)
  const probe = path.join(watchedRoot, 'probe.txt')
  const ready = Promise.withResolvers<void>()
  const observed: string[] = []
  const errors: unknown[] = []
  const pendingServer = createServer({
    root: watchedRoot,
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false, watch: { usePolling: false } },
    plugins: [{
      name: 'native-watch-control',
      configureServer(server) {
        server.watcher.once('ready', ready.resolve)
        server.watcher.on('error', (error) => {
          errors.push(error)
          ready.reject(error)
        })
        server.watcher.on('add', file => observed.push(path.resolve(file)))
      },
    }],
  })
  try {
    await Promise.all([pendingServer, ready.promise])
    // ready 后只写入一次；不增加等待时长、不重复保存，也不退回轮询文件系统。
    await writeFile(probe, 'changed')
    await expect.poll(() => observed, { timeout: 5000 }).toContain(probe)
    expect(await readFile(probe, 'utf8')).toBe('changed')
    expect(errors).toEqual([])
  }
  finally {
    await pendingServer.then(server => server.close(), () => {})
  }
}, 15_000)
