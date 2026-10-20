import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { parseSync } from 'oxc-parser'

export const hash = value => createHash('sha256').update(value).digest('hex')
const forbidden = value => /^(?:chokidar|readdirp)(?:\/|$)/.test(value)

/** 按 tar 条目读取实际发布归档，同时处理 npm 可能生成的 PAX 长路径。 */
export function readArchive(buffer) {
  const archive = gunzipSync(buffer)
  const entries = new Map()
  let extendedPath
  for (let offset = 0; offset + 512 <= archive.length;) {
    const header = archive.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) {
      break
    }
    const text = (start, size) => header.subarray(start, start + size).toString().replace(/\0.*$/s, '')
    const size = Number.parseInt(text(124, 12).trim() || '0', 8)
    assert(Number.isSafeInteger(size) && size >= 0, 'Invalid tar entry size')
    const start = offset + 512
    assert(start + size <= archive.length, 'Truncated package archive')
    const body = archive.subarray(start, start + size)
    const type = text(156, 1)
    if (type === 'x') {
      for (const match of body.toString().matchAll(/(?:^|\n)\d+ path=([^\n]+)\n/g)) {
        extendedPath = match[1]
      }
    }
    else if (type === 'L') {
      extendedPath = body.toString().replace(/\0.*$/s, '')
    }
    else {
      const name = extendedPath ?? [text(345, 155), text(0, 100)].filter(Boolean).join('/')
      extendedPath = undefined
      assert(!path.posix.isAbsolute(name) && !name.split('/').includes('..'), 'Archive entry escapes package')
      if (type === '0' || type === '') {
        assert(!entries.has(name), `Duplicate archive entry: ${name}`)
        entries.set(name, body)
      }
    }
    offset = start + Math.ceil(size / 512) * 512
  }
  return entries
}

/** 只检查运行时导入语义，不依赖 chunk 名称、压缩变量或补丁文字。 */
export function inspectRuntimeImports(filename, source) {
  const result = parseSync(filename, source, { sourceType: 'module' })
  assert.equal(result.errors.length, 0, `Cannot parse published runtime: ${filename}`)
  const imports = []
  const visit = (node) => {
    if (!node || typeof node !== 'object') {
      return
    }
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type)) {
      if (typeof node.source?.value === 'string') {
        imports.push(node.source.value)
      }
    }
    if (node.type === 'CallExpression' && typeof node.arguments?.[0]?.value === 'string' && forbidden(node.arguments[0].value)) {
      imports.push(node.arguments[0].value)
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        value.forEach(visit)
      }
      else if (value && typeof value === 'object') {
        visit(value)
      }
    }
  }
  visit(result.program)
  assert(!imports.some(forbidden), `Published runtime still imports an unpatched dependency: ${filename}`)
  return imports
}

/** 许可证来源使用维护安装中的完整上游文本，版本漂移必须显式更新声明。 */
export async function readLicenseRequirements() {
  const require = createRequire(import.meta.url)
  const chokidar = require.resolve('chokidar')
  const readdirp = createRequire(chokidar).resolve('readdirp')
  return await Promise.all([[chokidar, 'chokidar', '5.0.0'], [readdirp, 'readdirp', '5.1.1']].map(async ([entry, name, version]) => {
    const directory = path.dirname(entry)
    const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
    assert.equal(manifest.name, name)
    assert.equal(manifest.version, version, `Update bundled dependency notices: ${name}`)
    return { name, version, license: await readFile(path.join(directory, 'LICENSE'), 'utf8') }
  }))
}

/** 从实际 tarball 校验运行入口及许可证，并证明检查会拒绝外部导入。 */
export async function verifyPublishedArchive(filename, licenses) {
  const buffer = await readFile(filename)
  const entries = readArchive(buffer)
  const notice = entries.get('package/THIRD_PARTY_NOTICES.md')?.toString()
  assert(notice, 'Published tarball is missing third-party notices')
  for (const item of licenses) {
    assert(notice.includes(item.license), `Published tarball is missing the complete ${item.name} MIT license`)
    assert(notice.includes(item.version), `Published notice is missing ${item.name} version`)
  }
  const runtime = [...entries].filter(([name]) => /^package\/dist\/.*\.(?:mjs|cjs|js)$/.test(name))
  assert(runtime.length, 'Published package has no runtime output')
  const graph = runtime.map(([name, source]) => ({ file: name.slice('package/'.length), sha256: hash(source), imports: inspectRuntimeImports(name, source.toString()) }))
  for (const specifier of ['chokidar', 'chokidar/handler.js', 'readdirp']) {
    for (const source of [
      `import probe from ${JSON.stringify(specifier)}`,
      `export { default } from ${JSON.stringify(specifier)}`,
      `export const probe = () => import(${JSON.stringify(specifier)})`,
      `const probe = require(${JSON.stringify(specifier)})`,
    ]) {
      assert.throws(() => inspectRuntimeImports('negative-control.mjs', source), /unpatched dependency/)
    }
  }
  return { sha256: hash(buffer), bytes: buffer.length, files: entries.size, runtime: graph, licenses: licenses.map(({ name, version, license }) => ({ name, version, sha256: hash(license) })) }
}

/** 安装后的文件必须逐字来自已校验归档，禁止 postinstall 替换候选实现。 */
export async function verifyInstalledArchive(directory, filename) {
  const entries = readArchive(await readFile(filename))
  for (const [name, bytes] of entries) {
    assert(name.startsWith('package/'), `Unexpected package archive root: ${name}`)
    const relative = name.slice('package/'.length)
    assert.deepEqual(await readFile(path.join(directory, relative)), bytes, `Installed candidate differs from archive: ${relative}`)
  }
  return entries.size
}
