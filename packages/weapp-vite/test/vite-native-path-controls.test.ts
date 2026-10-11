import { access, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
// 保留 Windows 原生崩溃的退出码和 stderr，不让子进程中断其他对照。
// eslint-disable-next-line e18e/ban-dependencies
import { execa } from 'execa'
import { build } from 'vite'
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

// 原生失败对照保留在 scripts/diagnose-native-host-paths.mjs；门禁验证框架采用的安全输入。
it('observes a native filesystem event using the canonical temporary path', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'vite-native-watch-'))
  roots.push(root)
  const watchedRoot = await realpath(root)
  const result = await execa(process.execPath, ['--input-type=module', '-e', `
    import { watch, writeFileSync } from 'node:fs'
    import path from 'node:path'
    const root = process.argv[1]
    const timer = setTimeout(() => { watcher.close(); process.exitCode = 2 }, 5000)
    const watcher = watch(root, (_event, filename) => {
      if (filename === 'probe.txt') {
        clearTimeout(timer)
        watcher.close()
        console.log('observed')
      }
    })
    // 等待原生 watcher 完成注册，避免在高负载下写入早于操作系统事件订阅。
    setImmediate(() => writeFileSync(path.join(root, 'probe.txt'), 'changed'))
  `, watchedRoot], { reject: false, timeout: 10_000 })
  expect({ exitCode: result.exitCode, stderr: result.stderr, stdout: result.stdout }).toEqual({
    exitCode: 0,
    stderr: '',
    stdout: 'observed',
  })
}, 15_000)
