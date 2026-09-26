import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

/** 构建计时结束后核对实际页面产物，不能把成功退出但缺文件的样本记作通过。 */
export async function verifyBenchmarkAppOutputs(root: string) {
  const manifest = JSON.parse(await readFile(path.join(root, 'dist/app.json'), 'utf8')) as { pages?: unknown, subPackages?: unknown, subpackages?: unknown }
  assert.ok(Array.isArray(manifest.pages) && manifest.pages.length)
  const pages: string[] = []
  const addPages = (entries: unknown, prefix = '') => {
    assert.ok(Array.isArray(entries))
    for (const entry of entries) {
      assert.equal(typeof entry, 'string')
      assert.ok(entry.length && !entry.startsWith('/') && !entry.split('/').includes('..'))
      pages.push(path.posix.join(prefix, entry))
    }
  }
  addPages(manifest.pages)
  const subpackages = manifest.subPackages ?? manifest.subpackages ?? []
  assert.ok(Array.isArray(subpackages))
  for (const subpackage of subpackages) {
    assert.equal(typeof subpackage.root, 'string')
    addPages(subpackage.pages, subpackage.root)
  }
  const hash = createHash('sha256')
  for (const page of pages) {
    for (const extension of ['.js', '.wxml']) {
      const source = await readFile(path.join(root, 'dist', `${page}${extension}`))
      if (extension === '.js') {
        assert.ok(source.length, `Empty page script: ${page}`)
      }
      hash.update(page + extension)
      hash.update(source)
    }
  }
  return { pageCount: pages.length, sha256: hash.digest('hex') }
}
