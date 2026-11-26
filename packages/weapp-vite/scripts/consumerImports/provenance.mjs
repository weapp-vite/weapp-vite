import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
// eslint-disable-next-line e18e/ban-dependencies -- 使用 npm 的 semver 语义核对发布包声明的依赖范围。
import { satisfies } from 'semver'
import { consumerToolchainVersions } from '../consumerToolchains.mjs'

/** 将实际加载的 JS 与锁文件指向的官方 npm 档案逐字节比较，避免仅凭版本号判断未打补丁。 */
export async function inspectOriginalDependencies(root, toolchain) {
  const require = createRequire(path.join(root, 'package.json'))
  const compilerManifest = require.resolve('weapp-vite/package.json')
  const compilerRequire = createRequire(compilerManifest)
  const { dependencies } = JSON.parse(await readFile(compilerManifest, 'utf8'))
  const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'))
  const results = []
  for (const name of ['vite', 'rolldown']) {
    const manifest = compilerRequire.resolve(`${name}/package.json`)
    const directory = path.dirname(manifest)
    const metadata = JSON.parse(await readFile(manifest, 'utf8'))
    if (toolchain === 'vite-plus' && name === 'vite') {
      assert.equal(metadata.name, '@voidzero-dev/vite-plus-core')
      assert.equal(metadata.version, consumerToolchainVersions['vite-plus'].core)
    }
    else {
      assert.equal(metadata.name, name)
      assert(satisfies(metadata.version, dependencies[name]), `${name}@${metadata.version} does not satisfy the published range ${dependencies[name]}`)
    }
    const key = path.relative(root, directory).replaceAll('\\', '/')
    const entry = lock.packages[key]
    assert(entry?.resolved?.startsWith('https://registry.npmjs.org/'), `${name} must come from the npm registry`)
    assert.equal(entry.version, metadata.version, `${name} must match the consumer lockfile`)
    const response = await fetch(entry.resolved, { signal: AbortSignal.timeout(30_000) })
    assert(response.ok, `Registry archive failed: ${response.status}`)
    const archive = Buffer.from(await response.arrayBuffer())
    const [algorithm, digest] = entry.integrity.split('-', 2)
    assert.equal(createHash(algorithm).update(archive).digest('base64'), digest, `${name} archive integrity`)
    const tar = gunzipSync(archive)
    const contents = createHash('sha256')
    let files = 0
    for (let offset = 0; offset + 512 <= tar.length;) {
      const header = tar.subarray(offset, offset + 512)
      const string = (start, length) => header.subarray(start, start + length).toString().replace(/\0.*$/s, '')
      const filename = [string(345, 155), string(0, 100)].filter(Boolean).join('/')
      if (!filename) {
        break
      }
      const size = Number.parseInt(string(124, 12).trim(), 8) || 0
      const source = tar.subarray(offset + 512, offset + 512 + size)
      if (filename.startsWith('package/') && /\.(?:[cm]?js|json)$/.test(filename) && ['0', ''].includes(string(156, 1))) {
        const relative = filename.slice('package/'.length)
        assert(!relative.split('/').includes('..'))
        assert.deepEqual(await readFile(path.join(directory, relative)), source, `${name}/${relative} differs from its registry archive`)
        contents.update(relative).update(source)
        files++
      }
      offset += 512 + Math.ceil(size / 512) * 512
    }
    assert(files > 0)
    const hostRequire = createRequire(manifest)
    const engine = name === 'vite' ? hostRequire.resolve(toolchain === 'vite-plus' ? '@voidzero-dev/vite-plus-core/rolldown/experimental' : 'rolldown') : undefined
    results.push({ name: metadata.name, version: metadata.version, bundledVersions: metadata.bundledVersions, manifest, engine, resolved: entry.resolved, integrity: entry.integrity, comparedFiles: files, contentSha256: contents.digest('hex'), patched: false })
  }
  return results
}
