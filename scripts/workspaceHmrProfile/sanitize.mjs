import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url)).replace(/[\\/]$/, '')
const decoder = new TextDecoder('utf-8', { fatal: true })
const sha256 = content => createHash('sha256').update(content).digest('hex')

function encodedForms(value) {
  const normalized = value.replaceAll('\\', '/')
  const forms = new Set([value, normalized, value.replaceAll('/', '\\')])
  for (const item of [...forms]) {
    const json = JSON.stringify(item).slice(1, -1)
    forms.add(json)
    forms.add(JSON.stringify(json).slice(1, -1))
    forms.add(item.replaceAll('/', '\\/'))
    forms.add(encodeURI(item))
    forms.add(encodeURIComponent(item))
    forms.add(encodeURIComponent(encodeURIComponent(item)))
  }
  return [...forms].filter(Boolean).sort((a, b) => b.length - a.length)
}

function decodedViews(text) {
  const views = new Set([text])
  for (let pass = 0; pass < 2; pass++) {
    for (const view of [...views]) {
      views.add(view.replaceAll('\\"', '"').replaceAll('\\/', '/').replaceAll('\\\\', '\\'))
      try {
        views.add(decodeURIComponent(view))
      }
      catch { /* 日志不必整体符合 URI 编码；原始视图仍参与发现。 */ }
    }
  }
  return views
}

function discoverReplacements(texts, roots) {
  const replacements = new Map()
  for (const root of roots.filter(Boolean)) {
    replacements.set(root.replace(/[\\/]$/, ''), '<repo>')
  }
  for (const temporaryRoot of [process.env.RUNNER_TEMP, process.env.TMPDIR, process.env.TEMP].filter(Boolean)) {
    replacements.set(temporaryRoot.replace(/[\\/]$/, ''), '<temp>')
  }
  for (const text of texts) {
    for (const view of decodedViews(text)) {
      for (const match of view.matchAll(/(?:\/Users\/|\/home\/)[^/\s"'\\]+|[A-Z]:\\Users\\[^\\\s"']+/gi)) {
        replacements.set(match[0], '<home>')
      }
      for (const match of view.matchAll(/(?:["']token["']|\btoken)\s*[:=]\s*["']([^"'\s]+)["']/g)) {
        replacements.set(match[1], '<token>')
      }
      for (const match of view.matchAll(/[?&]token=([^&\s"'\\]+)/g)) {
        replacements.set(match[1], '<token>')
      }
      for (const match of view.matchAll(/(?:https?|wss?):\/\/(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1\])(?::\d+)?/g)) {
        replacements.set(match[0], '<local-origin>')
      }
      for (const match of view.matchAll(/\/home\/runner\/work\/([^/\s"'\\]+)\/\1(?=[/\s"'\\]|$)/g)) {
        replacements.set(match[0], '<repo>')
      }
    }
  }
  return [...replacements.entries()].flatMap(([value, replacement]) => encodedForms(value).map(form => [form, replacement])).sort(([a], [b]) => b.length - a.length)
}

function sanitizeText(text, replacements) {
  let result = text
  for (const [value, replacement] of replacements) {
    // 百分号编码的十六进制大小写不影响原始值。
    if (/%[0-9a-f]{2}/i.test(value)) {
      const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      result = result.replace(new RegExp(escaped, 'gi'), replacement)
    }
    else {
      result = result.split(value).join(replacement)
    }
  }
  return result
}

async function collectFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const result = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isSymbolicLink()) {
      throw new Error('Diagnostic input must not contain symbolic links.')
    }
    if (entry.isDirectory()) {
      result.push(...await collectFiles(path.join(directory, entry.name), relative))
    }
    else if (entry.isFile()) {
      result.push(relative)
    }
  }
  return result
}

/** 保留原始诊断数据，另写脱敏副本及每个文件的哈希映射。 */
export async function sanitizeDirectory(input, output, options = {}) {
  let inputRoot
  try {
    inputRoot = await realpath(input)
    if (!(await stat(inputRoot)).isDirectory()) {
      throw new Error('not a directory')
    }
  }
  catch {
    throw new Error('Diagnostic input directory is missing or unreadable; no artifact was created.')
  }
  const outputRoot = path.resolve(output)
  const relativeOutput = path.relative(inputRoot, outputRoot)
  if (!relativeOutput || (!relativeOutput.startsWith('..') && !path.isAbsolute(relativeOutput))) {
    throw new Error('Diagnostic artifact must be outside its raw input directory.')
  }
  const paths = await collectFiles(inputRoot)
  if (!paths.length) {
    throw new Error('Diagnostic input is empty; no artifact was created.')
  }
  const files = await Promise.all(paths.map(async (relative) => {
    const bytes = await readFile(path.join(inputRoot, relative))
    let text
    try {
      text = decoder.decode(bytes)
    }
    catch { /* 二进制只建立哈希记录，不发布无法检查的内容。 */ }
    return { relative, bytes, text }
  }))
  const replacements = discoverReplacements(files.flatMap(file => file.text === undefined ? [] : [file.text]), [repoRoot, process.env.GITHUB_WORKSPACE, ...(options.roots ?? [])])
  // 输出目录必须是全新的，拒绝把旧一轮证据混入当前 artifact。
  await mkdir(path.dirname(outputRoot), { recursive: true })
  await mkdir(outputRoot)
  const manifest = { diagnosticOnly: true, sanitized: true, rawPreserved: true, files: [] }
  for (const file of files) {
    const rawSha256 = sha256(file.bytes)
    if (file.text === undefined) {
      manifest.files.push({ rawPath: file.relative, rawSha256, status: 'binary-omitted' })
      continue
    }
    const sanitized = Buffer.from(sanitizeText(file.text, replacements))
    const sanitizedSha256 = sha256(sanitized)
    const target = path.join(outputRoot, file.relative)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, sanitized)
    manifest.files.push({ rawPath: file.relative, sanitizedPath: file.relative, rawSha256, sanitizedSha256, status: 'sanitized', rawBytes: file.bytes.byteLength, sanitizedBytes: sanitized.byteLength })
  }
  await writeFile(path.join(outputRoot, 'sanitization-manifest.json'), JSON.stringify(manifest, null, 2))
  return manifest
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2] || !process.argv[3]) {
      throw new Error('Usage: sanitize.mjs <raw-directory> <artifact-directory>')
    }
    const manifest = await sanitizeDirectory(process.argv[2], process.argv[3])
    process.stdout.write(`Sanitized diagnostic artifact: ${manifest.files.length} indexed files; raw data retained.\n`)
  }
  catch (error) {
    process.stderr.write(`${error instanceof Error && /Diagnostic|Usage:/.test(error.message) ? error.message : 'Diagnostic sanitization failed; do not upload partial artifacts.'}\n`)
    process.exitCode = 1
  }
}
