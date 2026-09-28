import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, symlink } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const workspace = path.resolve(here, '../..')
  const checkout = path.resolve(process.env.WEAPP_VITE_TARO_CHECKOUT ?? path.join(workspace, '.tmp/shared-hosts/taro'))
  const pluginRoot = path.join(checkout, 'packages/vite-plugin-taro')
  const require = createRequire(path.join(pluginRoot, 'package.json'))
  const { createServer, build, createLogger } = await import(pathToFileURL(require.resolve('vite')).href)
  const { default: vpt } = await import(pathToFileURL(path.join(pluginRoot, 'src/index.ts')).href)
  const project = await mkdtemp(path.join(checkout, 'demo/shared-host-runtime-'))
  await cp(path.join(here, 'fixture'), project, { recursive: true })
  await symlink(path.join(pluginRoot, 'node_modules'), path.join(project, 'node_modules'), 'junction')
  const target = process.env.WEAPP_VITE_TARO_TARGET ?? 'wx'
  const sourceProject = JSON.parse(await readFile(path.join(workspace, 'e2e-apps/github-issues/project.config.json'), 'utf8'))
  const logger = createLogger()
  const originalError = logger.error.bind(logger)
  logger.error = (message, options) => {
    originalError(message, options)
    if (options?.error) {
      process.stderr.write(`${options.error.stack ?? options.error}\n`)
    }
  }
  const config = {
    customLogger: logger,
    root: project,
    configFile: false,
    plugins: [{
      name: 'shared-host-observer',
      buildStart() {
        process.stdout.write('SHARED_HOST_PHASE=build-start\n')
      },
      buildEnd(error) {
        process.stdout.write(`SHARED_HOST_PHASE=build-end error=${Boolean(error)}\n`)
        if (error) {
          process.stderr.write(`SHARED_HOST_BUILD_ERROR=${error.stack ?? error.message ?? String(error)}\n`)
        }
      },
      renderStart() {
        process.stdout.write('SHARED_HOST_PHASE=render-start\n')
      },
      generateBundle() {
        process.stdout.write('SHARED_HOST_PHASE=generate-bundle\n')
      },
      writeBundle() {
        process.stdout.write('SHARED_HOST_PHASE=write-bundle\n')
      },
      configureServer(server) {
        server.ws.on('vpt:mini-hmr:report', report => process.stdout.write(`SHARED_HOST_REPORT=${JSON.stringify(report)}\n`))
      },
    }, vpt({
      target,
      app: 'src/app.tsx',
      pages: [{ path: 'pages/index/index' }],
      appJson: { window: { navigationBarTitleText: 'Shared compiler' } },
      projectConfigJson: {
        appid: sourceProject.appid,
        libVersion: sourceProject.libVersion,
        compileType: 'miniprogram',
        miniprogramRoot: './',
        setting: { urlCheck: false, es6: false, postcss: false, minified: false, enhance: false, minifyWXSS: false, minifyWXML: false, compileHotReLoad: true },
      },
      projectPrivateConfigJson: { setting: { urlCheck: false }, condition: { miniprogram: { list: [{ id: 0, name: 'Shared compiler', pathName: 'pages/index/index', query: '', scene: null }] } } },
      sitemapJson: { rules: [{ action: 'allow', page: '*' }] },
      hmr: { mode: process.env.WEAPP_VITE_TARO_HMR_MODE ?? 'devtools' },
    })],
    build: { outDir: path.join(project, 'dist'), sourcemap: true, minify: false },
    server: { host: '127.0.0.1', port: 0, strictPort: true },
  }
  if (process.argv.includes('--build')) {
    const result = await build(config)
    const outputs = Array.isArray(result) ? result.flatMap(item => item.output) : result.output
    const styleExtension = { wx: '.wxss', zfb: '.acss', tt: '.ttss' }[target]
    const templateExtension = { wx: '.wxml', zfb: '.axml', tt: '.ttml' }[target]
    const app = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8'))
    assert.ok(app.pages.includes('pages/index/index'))
    for (const extension of ['.js', '.json', templateExtension]) {
      assert.ok((await readFile(path.join(project, `dist/pages/index/index${extension}`), 'utf8')).length > 0)
    }
    const styles = await readFile(path.join(project, `dist/assets/global${styleExtension}`), 'utf8')
    assert.match(styles, /py-5_d5/)
    assert.match(styles, /#fce7f3/)
    const scripts = outputs.filter(item => item.type === 'chunk')
    assert.ok(scripts.some(item => item.code.includes('bg-_b_hfce7f3_B')))
    assert.ok(scripts.some(item => item.map?.mappings && item.map.sources.length > 0))
    process.stdout.write(`SHARED_HOST_PROJECT=${project}\n`)
  }
  else {
    const server = await createServer(config)
    await server.listen()
    process.stdout.write(`SHARED_HOST_NODE_ENV=${process.env.NODE_ENV}\n`)
    process.stdout.write(`SHARED_HOST_PROJECT=${project}\n`)
    if (process.argv.includes('--dev-build')) {
      await server.close()
      return
    }
    let closing = false
    const close = async () => {
      if (closing) {
        return
      }
      closing = true
      await server.close()
      process.exit(0)
    }
    process.once('SIGTERM', close)
    process.once('SIGINT', close)
  }
}

void main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`)
  process.exitCode = 1
})
