import assert from 'node:assert/strict'
import { lstat, readdir, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { relativeFile } from './tree.mjs'

/** 只遍历本轮目录的普通文件，拒绝 symlink 和其它跨目录入口。 */
export async function artifactFiles(directory, prefix = '') {
  const result = []
  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const file = prefix ? `${prefix}/${entry.name}` : entry.name
    relativeFile(file)
    assert(!entry.isSymbolicLink(), 'Execution artifact contains a symlink')
    if (entry.isDirectory()) {
      result.push(...await artifactFiles(directory, file))
    }
    else {
      assert(entry.isFile(), 'Execution artifact contains a non-file entry')
      result.push(file)
    }
  }
  return result.sort()
}

function patternRegex(pattern) {
  relativeFile(pattern)
  assert(!/[?[\]{}]/u.test(pattern), 'Execution artifact patterns support only * and ** segments')
  const escaped = value => value.replace(/[.+^$()|[\]\\]/gu, '\\$&').replaceAll('*', '[^/]*')
  return new RegExp(`^${pattern.split('/').map((part, index, parts) => part === '**'
    ? (index === parts.length - 1 ? '.*' : '(?:[^/]+/)*')
    : `${escaped(part)}${index === parts.length - 1 ? '' : '/'}`).join('')}$`, 'u')
}

/** 动态报告路径使用固定 pattern 与精确数量，不允许挑选最新一份掩盖重复证据。 */
export async function readArtifactDocuments(reference, download) {
  assert(reference && typeof reference.artifact === 'string' && reference.artifact, 'Missing execution artifact reference')
  assert(Boolean(reference.file) !== Boolean(reference.filePattern), 'Execution artifact needs exactly one file or filePattern')
  const { directory } = await download(reference.artifact)
  const root = await realpath(directory)
  const expectedCount = reference.file ? 1 : reference.expectedCount
  assert(Number.isSafeInteger(expectedCount) && expectedCount > 0, 'Execution artifact selector needs an exact positive count')
  const files = reference.file ? [relativeFile(reference.file)] : (await artifactFiles(directory)).filter(file => patternRegex(reference.filePattern).test(file))
  assert(files.length === expectedCount, `Execution artifact selector expected ${expectedCount} files; found ${files.length}`)
  return Promise.all(files.map(async (file) => {
    let checked = directory
    for (const part of file.split('/')) {
      checked = path.join(checked, part)
      assert(!(await lstat(checked)).isSymbolicLink(), 'Execution artifact contains a symlink')
    }
    const filename = await realpath(path.join(directory, file))
    const relative = path.relative(root, filename)
    assert(relative && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative), 'Execution artifact escaped temporary directory')
    return readFile(filename)
  }))
}
