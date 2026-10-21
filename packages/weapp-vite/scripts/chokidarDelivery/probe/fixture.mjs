import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { deliveryBuildTracePlugin } from './trace.mjs'

export const weappOptions = {
  platform: 'weapp',
  srcRoot: 'src',
  autoRoutes: false,
  copy: { include: ['**/*.txt'] },
  hmr: { runtime: 'classic' },
  mcp: false,
}

export async function createFixture(root) {
  const trace = process.env.WEAPP_VITE_DELIVERY_TRACE === '1'
  const traceSource = trace ? `const deliveryBuildTracePlugin = ${deliveryBuildTracePlugin.toString()}\n` : ''
  const tracePlugins = trace ? 'plugins: [deliveryBuildTracePlugin(import.meta.dirname)], ' : ''
  const files = {
    'package.json': JSON.stringify({ name: 'weapp-vite-host-watcher-delivery', private: true, type: 'module' }),
    'project.config.json': JSON.stringify({ miniprogramRoot: '.weapp-vite/delivery-host' }),
    'vite.config.mjs': `import { defineConfig } from 'weapp-vite'
${traceSource}export default defineConfig({ ${tracePlugins}weapp: ${JSON.stringify(weappOptions)}, build: { minify: false } })
`,
    'src/app.js': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
    'src/pages/index/index.js': 'Page({ data: { message: "watcher-delivery" } })',
    'src/pages/index/index.json': '{}',
    'src/pages/index/index.wxml': '<view>{{message}}</view>',
    'src/shared/marker.txt': 'before-shared-mutation',
    'src/reborn/marker.txt': 'before-registration',
  }
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(root, name)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, text)
  }
}

export async function waitForFile(file, expected, observe) {
  const deadline = Date.now() + 45_000
  while (Date.now() < deadline) {
    try {
      const value = await readFile(file, 'utf8')
      observe?.({ exists: true, text: value })
      if (expected !== null && value === expected) {
        return
      }
    }
    catch (error) {
      if (error.code !== 'ENOENT') {
        throw error
      }
      observe?.({ exists: false })
      if (expected === null) {
        return
      }
    }
    await delay(20)
  }
  assert.fail(`Consumer output did not reach expected state: ${path.basename(file)}`)
}

/** 解析必须来自当前 npm consumer，不能通过仓库源码或依赖链接满足公开入口。 */
export function verifyPublicResolution(consumerRoot) {
  const require = createRequire(path.join(consumerRoot, 'package.json'))
  const compiler = createRequire(require.resolve('weapp-vite/package.json'))
  assert.equal(require.resolve('vite/package.json'), compiler.resolve('vite/package.json'), 'Public host and compiler must resolve the same installed Vite')
  const entries = ['weapp-vite/test', 'weapp-vite/vite', 'weapp-vite', 'vite']
  return entries.map((name) => {
    const file = fileURLToPath(import.meta.resolve(name))
    const relative = path.relative(path.join(consumerRoot, 'node_modules'), file)
    assert(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), `Public entry escaped npm consumer: ${name}`)
    return { name, file: relative.replaceAll('\\', '/') }
  })
}
