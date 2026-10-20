import assert from 'node:assert/strict'
import path from 'node:path'
import { waitForFile, weappOptions } from './fixture.mjs'
import { bounded } from './native.mjs'
import { createPublicationObserver } from './publication.mjs'

/** 从普通 npm 安装的两个公开入口取得 owner，不导入维护仓库源码。 */
export async function openPublicOwner(kind, root, owners, errors) {
  const outDir = path.join(root, '.weapp-vite', `delivery-${kind}`)
  if (kind === 'artifact') {
    const publications = createPublicationObserver(outDir)
    const { watchTestArtifact } = await import('weapp-vite/test')
    const watcher = await bounded(watchTestArtifact({
      cwd: root,
      outDir,
      onError: error => errors.push(error),
      onRebuilt: artifact => publications.onRebuilt(artifact),
    }), 'public watchTestArtifact initialization', 60_000)
    const owner = { kind, outDir, publications, close: () => watcher.close() }
    owners.push(owner)
    assert.equal(path.resolve(watcher.artifact.miniprogramRootPath), path.resolve(outDir))
    return owner
  }
  assert.equal(kind, 'host')
  const [{ createServer }, { weapp }] = await Promise.all([import('vite'), import('weapp-vite/vite')])
  const server = await bounded(createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    weapp: weappOptions,
    plugins: [weapp(), {
      name: 'consumer:exclude-host-chokidar',
      enforce: 'post',
      // config 返回的 null 会被 Vite 合并忽略；resolved 钩子完成后才创建宿主 watcher。
      configResolved: {
        order: 'post',
        handler(config) {
          if (config.command === 'serve') {
            config.server.watch = null
          }
        },
      },
    }],
    build: { minify: false, outDir },
    server: { watch: null, hmr: false, middlewareMode: true },
  }), 'public Vite host initialization', 60_000)
  const owner = { kind, outDir, close: () => server.close() }
  owners.push(owner)
  assert.equal(server.config.server.watch, null, 'Vite internal Chokidar must remain disabled')
  return owner
}

export async function assertOutput(owner, relative, text) {
  await waitForFile(path.join(owner.outDir, relative), text)
}

export async function closeOwner(owner) {
  await bounded(owner.close(), `${owner.kind} public close`, 60_000)
  await bounded(owner.close(), `${owner.kind} repeated public close`, 60_000)
}
