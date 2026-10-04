import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const output = process.env.WEAPP_VITE_CHUNK_CAPTURE
if (!output) {
  throw new Error('Expected WEAPP_VITE_CHUNK_CAPTURE=<new JSON file>')
}
const dist = `${pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../packages/weapp-vite/dist')).href}/`
const anchor = 'const rewriteBundle = resolveDevHmrRewriteBundle(rolldownBundle, state, activeImportedChunkIds);'
const captureKey = '__weappViteExperimentalChunkCapture'
let loaded = 0
let captured = 0
let distSha256: string | undefined

/** 只记录真实改写边界的 chunk；不修改 bundle 或写入构建产物。 */
function capture(bundle: Record<string, { type: string, code?: string, fileName: string }>, configuration: unknown) {
  if (++captured !== 1) {
    throw new Error('Capture expects exactly one main production bundle')
  }
  const outputs = Object.values(bundle)
  const inputs = outputs.filter(item => item.type === 'chunk').map((item) => {
    if (typeof item.code !== 'string') {
      throw new TypeError('OutputChunk has no code')
    }
    return { filename: item.fileName, code: item.code }
  })
  writeFileSync(output!, `${JSON.stringify({
    schemaVersion: 1,
    boundary: 'resolveDevHmrRewriteBundle:before-script-analysis',
    distSha256,
    configuration,
    assetsIgnored: outputs.filter(item => item.type === 'asset').length,
    inputs,
  }, null, 2)}\n`, { flag: 'wx' })
}

if (Object.hasOwn(globalThis, captureKey)) {
  throw new Error('Chunk capture already installed')
}
Object.defineProperty(globalThis, captureKey, { value: capture, configurable: true })

// 诊断加载器只替换本次进程内的模块源码；保留磁盘 dist 和生产 API。
registerHooks({
  load(url, context, nextLoad) {
    if (!url.startsWith(dist) || !url.endsWith('.mjs')) {
      return nextLoad(url, context)
    }
    const source = readFileSync(fileURLToPath(url), 'utf8')
    if (!source.includes(anchor)) {
      return nextLoad(url, context)
    }
    if (source.split(anchor).length !== 2 || ++loaded !== 1) {
      throw new Error('Ambiguous production rewrite boundary; update the diagnostic loader')
    }
    distSha256 = createHash('sha256').update(source).digest('hex')
    return {
      format: 'module',
      shortCircuit: true,
      source: source.replace(anchor, `${anchor}\nglobalThis.${captureKey}(rewriteBundle, { platform: configService.platform, astEngine, injectWeapi: configService.weappViteConfig?.injectWeapi ?? false });`),
    }
  },
})

process.on('exit', () => {
  delete (globalThis as unknown as Record<string, unknown>)[captureKey]
  if (loaded !== 1 || captured !== 1) {
    process.stderr.write('Expected exactly one captured rewrite boundary; rebuild weapp-vite and check the diagnostic anchor\n')
    process.exitCode = 1
  }
})
