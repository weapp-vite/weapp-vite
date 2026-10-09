import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import vm from 'node:vm'

const require = createRequire(import.meta.url)

export async function readInstalledVite() {
  const manifestPath = require.resolve('vite/package.json')
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  assert.equal(manifest.name, 'vite')
  assert.equal(typeof manifest.version, 'string')
  const chunkDirectory = path.join(path.dirname(manifestPath), 'dist/node/chunks')
  const candidates = []
  for (const name of await fs.readdir(chunkDirectory)) {
    if (!/\.[cm]?js$/.test(name)) {
      continue
    }
    const source = await fs.readFile(path.join(chunkDirectory, name), 'utf8')
    if (source.includes('function wrapHookObject(') && source.includes('function oxcResolvePlugin(')) {
      candidates.push(source)
    }
  }
  assert.equal(candidates.length, 1, 'Installed Vite source layout changed; review the ownership contract extraction before upgrading')
  const source = candidates[0]
  return { source, version: manifest.version, sha256: createHash('sha256').update(source).digest('hex') }
}

export function extract(source, startText, endText) {
  const start = source.indexOf(startText)
  const end = source.indexOf(endText, start + startText.length)
  assert.ok(start >= 0 && end > start, `Installed Vite contract boundary is missing: ${startText}`)
  return source.slice(start, end)
}

export function evaluateStrict(source, globals = {}) {
  const context = vm.createContext(globals)
  // 依赖原文件以 ESM 执行，提取后的赋值失败和访问器行为也必须保持严格模式。
  new vm.Script(`"use strict";\n${source}`).runInContext(context)
  return context
}
