import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

async function main() {
  const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const checkout = path.resolve(process.env.WEAPP_VITE_TARO_CHECKOUT ?? path.join(workspace, '.tmp/shared-hosts/taro'))
  const root = path.join(checkout, 'packages/vite-plugin-taro')
  const require = createRequire(path.join(root, 'package.json'))
  for (const name of ['@weapp-vite/hmr', '@weapp-vite/tailwindcss']) {
    const manifestPath = require.resolve(`${name}/package.json`)
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    assert.equal(manifest.name, name)
    for (const dependency of ['weapp-vite', 'wevu', '@tarojs/runtime', 'rolldown', 'vite']) {
      assert.equal(manifest.dependencies?.[dependency], undefined)
    }
    await import(pathToFileURL(path.resolve(path.dirname(manifestPath), manifest.exports['.'].import)).href)
  }
  const installed = await readdir(path.join(checkout, 'node_modules/.pnpm'))
  assert.equal(installed.some(name => name.startsWith('weapp-vite@')), false)
  assert.deepEqual(installed.filter(name => name.startsWith('rolldown@')), ['rolldown@1.2.9'])
  process.stdout.write('Packed shared packages load independently; no weapp-vite installation; Rolldown 1.2.9 only.\n')
}

void main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`)
  process.exitCode = 1
})
