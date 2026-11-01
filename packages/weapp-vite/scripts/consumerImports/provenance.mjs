import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'

/** 将实际加载的 JS 与锁文件指向的官方 npm 档案逐字节比较，避免仅凭版本号判断未打补丁。 */
export async function inspectOriginalDependencies(root, toolchain) {
  const require = createRequire(path.join(root, 'package.json'))
  const compilerRequire = createRequire(require.resolve('weapp-vite/package.json'))
  const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'))
  const results = []
  for (const [name, version] of [['vite', '8.3.5'], ['rolldown', '1.2.16']]) {
    const manifest = compilerRequire.resolve(`${name}/package.json`)
    const directory = path.dirname(manifest)
    const metadata = JSON.parse(await readFile(manifest, 'utf8'))
    if (toolchain === 'vite-plus' && name === 'vite') {
      // Vite+ 有自己批准的官方宿主，不能把其 alias 宣称为普通 Vite。
      assert.equal(metadata.name, '@voidzero-dev/vite-plus-core')
    }
    else {
      assert.equal(metadata.name, name)
      assert.equal(metadata.version, version)
    }
    const key = path.relative(root, directory).replaceAll('\\', '/')
    const entry = lock.packages[key]
    assert(entry?.resolved?.startsWith('https://registry.npmjs.org/'), `${name} must come from the npm registry`)
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
