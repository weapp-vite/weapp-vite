import assert from 'node:assert/strict'
import path from 'node:path'
import process from 'node:process'
import { setImmediate } from 'node:timers/promises'
import { createRuntimeState } from '../../runtime/runtimeState'
import { createOutputPublicationPlugin } from '../outputFinalizer/publication'
import { createWevuAutoPageFeaturesPlugin } from '../wevu'

const scenario = process.argv[2]
const root = path.resolve('plugin-context-fixture')
const ctx = {
  configService: { cwd: root, absoluteSrcRoot: path.join(root, 'src'), isDev: true },
  scanService: {
    loadAppEntry: async () => ({ json: { pages: ['pages/home'] } }),
    loadSubPackages: () => [],
    independentSubPackageMap: new Map(),
  },
  runtimeState: createRuntimeState(),
}

const plugin = scenario === 'page-matcher'
  ? createWevuAutoPageFeaturesPlugin(ctx as any)
  : createOutputPublicationPlugin(ctx as any)

function handler(hook: any) {
  return typeof hook === 'function' ? hook : hook?.handler
}

async function exercise() {
  const hookContext = { meta: { watchMode: false }, warn() {}, addWatchFile() {}, emitFile() {}, resolve() {} }
  const weak = new WeakRef(hookContext)
  if (scenario === 'page-matcher') {
    await handler(plugin.transform).call(hookContext, 'Page({})', path.join(root, 'src/pages/home.ts'))
  }
  else {
    const isWrite = scenario === 'pending-output-publication'
    await handler(plugin.configResolved)({ root, build: { outDir: 'dist', write: isWrite, copyPublicDir: false } })
    await handler(plugin.generateBundle).call(hookContext, {}, {}, isWrite)
  }
  return weak
}

async function main() {
  const weak = await exercise()
  assert.equal(typeof globalThis.gc, 'function')
  for (let round = 0; round < 8; round++) {
    await setImmediate()
    globalThis.gc!()
    await setImmediate()
  }
  // 插件与 matcher/发布状态仍合法存活；只有已结束 hook 的上下文应可回收。
  assert.ok(plugin.name)
  process.stdout.write(`${JSON.stringify({ scenario, collected: weak.deref() === undefined })}\n`)
}

void main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`)
  process.exitCode = 1
})
