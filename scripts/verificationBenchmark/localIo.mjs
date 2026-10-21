import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const localDigest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

export function localRelative(root, file, prefix = '.tmp/') {
  const relative = path.relative(root, path.resolve(root, file)).replaceAll('\\', '/')
  assert(relative.startsWith(prefix) && !relative.split('/').some(part => !part || part === '.' || part === '..'), 'Local evidence escapes its owned directory')
  return relative
}

export async function localText(root, file, prefix = '.tmp/') {
  const relative = localRelative(root, file, prefix)
  const absolute = path.join(root, relative)
  assert((await lstat(absolute)).isFile() && path.relative(await realpath(absolute), absolute) === '', 'Local evidence cannot use symbolic links')
  const bytes = await readFile(absolute, 'utf8')
  return { path: relative, digest: localDigest(bytes), value: bytes }
}

export async function localDocument(root, file, prefix = '.tmp/') {
  const document = await localText(root, file, prefix)
  return { ...document, value: JSON.parse(document.value) }
}

export async function localSave(file, value) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`)
}

export function localWithin(value, start, end) {
  const time = typeof value === 'number' ? value : Date.parse(value)
  assert(Number.isFinite(time) && time >= start && time <= end, 'Local evidence is stale or outside its invocation')
}
