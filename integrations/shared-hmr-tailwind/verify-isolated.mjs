import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 独立安装与构建需要跨平台子进程生命周期。
import { execa } from 'execa'
import { readHostDependencyOverrides } from './host-dependencies.mjs'

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const workspace = path.resolve(here, '../..')
  const prepared = path.join(workspace, '.tmp/shared-hosts')
  const checkout = path.resolve(process.env.WEAPP_VITE_TARO_CHECKOUT ?? path.join(prepared, 'taro'))
  const destination = path.join(prepared, 'isolated-tarballs')
  await mkdir(destination, { recursive: true })
  const installed = JSON.parse(await readFile(path.join(prepared, 'artifacts.json'), 'utf8'))
  const overrides = Object.fromEntries(installed.artifacts.map(item => [item.name, pathToFileURL(path.resolve(prepared, item.file)).href]))
  const hostManifest = JSON.parse(await readFile(path.join(checkout, 'packages/vite-plugin-taro/package.json'), 'utf8'))
  Object.assign(overrides, await readHostDependencyOverrides(hostManifest))
  for (const [repository, directory] of [
    [workspace, 'packages/hmr'],
    [workspace, 'packages/tailwindcss'],
    [checkout, 'packages/taro-runtime'],
    [checkout, 'packages/vite-plugin-taro'],
  ]) {
    const manifest = JSON.parse(await readFile(path.join(repository, directory, 'package.json'), 'utf8'))
    await execa('pnpm', ['--filter', manifest.name, 'pack', '--pack-destination', destination], { cwd: repository })
    const file = path.join(destination, `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`)
    const digest = createHash('sha256').update(await readFile(file)).digest('hex')
    const captured = file.replace(/\.tgz$/, `-${digest.slice(0, 12)}.tgz`)
    await rename(file, captured)
    overrides[manifest.name] = pathToFileURL(captured).href
  }
  const projectConfig = JSON.parse(await readFile(path.join(workspace, 'e2e-apps/github-issues/project.config.json'), 'utf8'))
  const isolated = await mkdtemp(path.join(tmpdir(), 'shared-host-install-'))
  try {
    const localTarballs = path.join(isolated, 'tarballs')
    await mkdir(localTarballs)
    for (const [name, specifier] of Object.entries(overrides)) {
      if (!specifier.startsWith('file:')) {
        continue
      }
      const source = fileURLToPath(specifier)
      const fileName = path.basename(source)
      await cp(source, path.join(localTarballs, fileName))
      overrides[name] = `file:./tarballs/${fileName}`
    }
    await writeFile(path.join(isolated, 'package.json'), JSON.stringify({
      private: true,
      type: 'module',
      dependencies: { 'vite-plugin-taro': overrides['vite-plugin-taro'], 'vite': '8.3.0', 'react': '19.3.0', 'react-dom': '19.3.0' },
    }, null, 2))
    await writeFile(path.join(isolated, 'pnpm-workspace.yaml'), `overrides: ${JSON.stringify(overrides)}\n`)
    await cp(path.join(here, 'fixture/src'), path.join(isolated, 'src'), { recursive: true })
    await execa('pnpm', ['install', '--no-frozen-lockfile', '--ignore-scripts'], { cwd: isolated, stdio: 'inherit' })
    // 驱动脚本也位于临时根，模块解析无法回退到本仓库 node_modules。
    await writeFile(path.join(isolated, 'verify.mjs'), `
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { build, createServer } from 'vite'
import vpt from 'vite-plugin-taro'
const require = createRequire(import.meta.url)
assert.throws(() => require.resolve('weapp-vite'), { code: 'MODULE_NOT_FOUND' })
const hostRequire = createRequire(require.resolve('vite-plugin-taro'))
const rolldown = JSON.parse(await readFile(hostRequire.resolve('rolldown/package.json'), 'utf8'))
assert.equal(rolldown.version, '1.2.9')
const viteRequire = createRequire(require.resolve('vite'))
const tailwindRequire = createRequire(hostRequire.resolve('@weapp-vite/tailwindcss/package.json'))
assert.equal(viteRequire.resolve('postcss/package.json'), tailwindRequire.resolve('postcss/package.json'))
await build({ root: process.cwd(), configFile: false, plugins: [vpt({ target: 'wx', app: 'src/app.tsx', pages: [{ path: 'pages/index/index' }], appJson: {}, projectConfigJson: { appid: ${JSON.stringify(projectConfig.appid)} } })], build: { minify: false } })
assert.match(await readFile('dist/assets/global.wxss', 'utf8'), /py-5_d5/)
console.info('ISOLATED_INSTALL_AND_NATIVE_BUILD_PASSED')
process.env.NODE_ENV = 'development'
for (const mode of ['rebuild', 'interpreter']) {
  let rejectBuild
  const failed = new Promise((_resolve, reject) => { rejectBuild = reject })
  const server = await createServer({ root: process.cwd(), configFile: false, plugins: [
    vpt({ target: 'wx', app: 'src/app.tsx', pages: [{ path: 'pages/index/index' }], appJson: {}, projectConfigJson: { appid: ${JSON.stringify(projectConfig.appid)} }, hmr: { mode } }),
    { name: 'isolation-guard', resolveId(id) { if (id === 'preact') throw new Error('Inactive Preact dependency requested') }, buildEnd(error) { if (error) rejectBuild(error) } }
  ], server: { host: '127.0.0.1', port: 0, strictPort: true } })
  try { await Promise.race([server.listen(), failed]) }
  finally { await server.close() }
}
console.info('ISOLATED_NORMAL_AND_STATEFUL_DEV_PASSED')
`)
    await execa(process.execPath, ['verify.mjs'], { cwd: isolated, stdio: 'inherit' })
  }
  finally {
    await rm(isolated, { recursive: true, force: true })
  }
}

void main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`)
  process.exitCode = 1
})
