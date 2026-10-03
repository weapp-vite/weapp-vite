import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

// 外部消费者示例：仅消费版本化 JSON 和构建目录，不猜测 runtime 文件名。
const [reportPath, outputDirectory] = process.argv.slice(2)
assert(reportPath && outputDirectory, 'Usage: node verify-analyze-artifacts.mjs <report.json> <output-directory>')
const report = JSON.parse(await readFile(reportPath, 'utf8'))
assert.equal(report.schemaVersion, 2, 'Unsupported analyze schema; expected version 2')
assert(Array.isArray(report.artifacts?.files) && report.artifacts.files.length > 0, 'Missing artifact inventory')
const files = new Set()
let total = 0
for (const artifact of report.artifacts.files) {
  assert(typeof artifact.file === 'string' && artifact.file.length > 0, 'Missing artifact path')
  assert(!path.isAbsolute(artifact.file) && !artifact.file.includes('\\') && !artifact.file.split('/').includes('..'), `Invalid artifact path: ${artifact.file}`)
  assert(!files.has(artifact.file), `Duplicate artifact: ${artifact.file}`)
  files.add(artifact.file)
  const content = await readFile(path.join(outputDirectory, artifact.file))
  assert.equal(content.byteLength, artifact.bytes, `Artifact size mismatch: ${artifact.file}`)
  assert.equal(createHash('sha256').update(content).digest('hex'), artifact.sha256, `Artifact content mismatch: ${artifact.file}`)
  total += content.byteLength
}
assert.equal(total, report.artifacts.totalBytes, 'Artifact total mismatch')
process.stdout.write(`${JSON.stringify({ files: files.size, totalBytes: total, runtime: report.artifacts.runtime })}\n`)
