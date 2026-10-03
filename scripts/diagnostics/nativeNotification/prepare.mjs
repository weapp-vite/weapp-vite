import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { Linter } from 'eslint'
import globals from 'globals'
import { transform } from './transform.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const require = createRequire(path.join(root, 'packages/weapp-vite/package.json'))
const vitePackage = require.resolve('vite/package.json')
const viteRoot = path.dirname(vitePackage)
const viteRequire = createRequire(vitePackage)
const rolldownRoot = path.dirname(viteRequire.resolve('rolldown/package.json'))
const hash = source => createHash('sha256').update(source).digest('hex')
const linter = new Linter()
const files = []
for (const [directory, kind, marker] of [[path.join(root, 'packages/weapp-vite/dist'), 'core', 'function createWatchChangeHook('], [path.join(rolldownRoot, 'dist'), 'rolldown', 'function bindingifyWatchChange('], [path.join(viteRoot, 'dist'), 'vite', 'const onFileChange = async (file) => {']]) {
  const found = []
  for (const rel of await readdir(directory, { recursive: true })) {
    if (!/\.(?:mjs|js)$/.test(rel)) {
      continue
    }
    const filename = await realpath(path.join(directory, rel))
    const source = await readFile(filename, 'utf8')
    if (!source.includes(marker)) {
      continue
    }
    const result = transform(source, filename, kind)
    const config = [{ languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node, ...globals.es2024 } }, rules: { 'no-undef': 'error' } }]
    const undefinedNames = text => linter.verify(text, config).map(message => message.message).sort()
    assert.deepEqual(undefinedNames(result.source), undefinedNames(source), `Inserted undefined identifier: ${kind}`)
    found.push({ path: path.relative(root, filename).replaceAll('\\', '/'), kind, sourceHash: hash(source), transformedHash: hash(result.source), inventory: result.inventory })
  }
  assert.equal(found.length, 1, `One module for ${kind}`)
  files.push(...found)
}
const sourcePaths = ['packages/weapp-vite/src/plugins/core/lifecycle/watch.ts', 'packages/weapp-vite/src/runtime/statefulHmr/session.ts', 'packages/weapp-vite/src/runtime/statefulHmr/viteAdapter.ts', 'scripts/benchmark-templates-hmr.ts', 'e2e/utils/dev-process-env.ts', 'pnpm-lock.yaml']
const sources = Object.fromEntries(await Promise.all(sourcePaths.map(async file => [file, hash(await readFile(path.join(root, file)))])))
const nativePackage = process.platform === 'linux' && process.arch === 'x64' ? '@rolldown/binding-linux-x64-gnu' : process.platform === 'darwin' && process.arch === 'arm64' ? '@rolldown/binding-darwin-arm64' : undefined
assert(nativePackage, 'Diagnostic supports the recorded Linux x64 GNU and macOS arm64 hosts only')
const native = createRequire(path.join(rolldownRoot, 'package.json')).resolve(nativePackage)
const manifest = { schema: 1, preparationOnly: true, preparedAt: new Date().toISOString(), files, sources, native: { path: path.relative(root, await realpath(native)), hash: hash(await readFile(native)) }, identity: { vite: JSON.parse(await readFile(vitePackage, 'utf8')).version, rolldown: JSON.parse(await readFile(path.join(rolldownRoot, 'package.json'), 'utf8')).version } }
await writeFile(new URL('./manifest.json', import.meta.url), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({ preparationOnly: true, modules: files.map(file => ({ kind: file.kind, events: file.inventory.length })), identity: manifest.identity, nativeUnmodified: true }))
