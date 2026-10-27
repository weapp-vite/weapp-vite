import type { ChangeSet } from './types.ts'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 验证入口需要跨平台命令解析和失败传播。
import { execa } from 'execa'

export function normalizeChangedPath(file: string): string {
  const normalized = file.replaceAll('\\', '/').replace(/^\.\//, '')
  if (!normalized || path.posix.isAbsolute(normalized) || /^[a-z]:\//i.test(normalized) || normalized.split('/').includes('..')) {
    throw new Error(`非法仓库相对路径: ${file}`)
  }
  return normalized
}

/** 解析 NUL 分隔的 Git 状态，重命名同时保留两端。 */
export function parseChangedNames(output: string): string[] {
  const fields = output.split('\0').filter(Boolean)
  const files: string[] = []
  for (let i = 0; i < fields.length;) {
    const status = fields[i++]!
    const count = /^[RC]/.test(status) ? 2 : 1
    if (!/^[ACDMRTUXB]\d*$/.test(status) || fields.length - i < count) {
      throw new Error('Git 返回了不完整的文件状态')
    }
    for (let j = 0; j < count; j++) {
      files.push(normalizeChangedPath(fields[i++]!))
    }
  }
  return [...new Set(files)].sort()
}

export async function readChanges(root: string, options: { base?: string, head?: string, files?: string[], signal?: AbortSignal } = {}): Promise<ChangeSet> {
  const git = async (args: string[]) => {
    options.signal?.throwIfAborted()
    const result = await execa('git', args, { cwd: root, cancelSignal: options.signal })
    options.signal?.throwIfAborted()
    return result.stdout
  }
  const head = (await git(['rev-parse', 'HEAD'])).trim()
  if (options.head) {
    if (options.files?.length) {
      throw new Error('固定提交验证不能同时筛选局部文件')
    }
    const candidate = (await git(['rev-parse', '--verify', `${options.head}^{commit}`])).trim()
    if (candidate !== head || await git(['status', '--porcelain', '--untracked-files=normal'])) {
      throw new Error('固定提交验证必须在对应提交的干净快照中执行')
    }
    const base = options.base ? (await git(['rev-parse', '--verify', `${options.base}^{commit}`])).trim() : null
    const files = base
      ? parseChangedNames(await git(['diff', '--name-status', '-z', '--find-renames', base, head, '--']))
      : (await git(['ls-tree', '-r', '--name-only', '-z', head])).split('\0').filter(Boolean).map(normalizeChangedPath).sort()
    const tree = (await git(['rev-parse', `${head}^{tree}`])).trim()
    return {
      base,
      head,
      files,
      fingerprint: createHash('sha256').update(JSON.stringify({ base, head, tree, files })).digest('hex'),
      fallback: !base,
      warnings: base ? [] : ['待推提交缺少可信比较基线，已保守选择全部验证范围'],
    }
  }
  const warnings: string[] = []
  let base: string | null = null
  if (options.base) {
    // 显式基线不存在时必须报错，不能缩减验证范围。
    base = (await git(['merge-base', 'HEAD', options.base])).trim()
  }
  else {
    for (const ref of ['origin/main', 'main']) {
      try {
        base = (await git(['merge-base', 'HEAD', ref])).trim()
        break
      }
      catch {
        options.signal?.throwIfAborted()
      }
    }
  }
  if (!base) {
    warnings.push('找不到可信比较基线，已保守选择全部验证范围')
  }
  const selected = options.files?.map(normalizeChangedPath)
  const files = selected ?? [...new Set([
    ...parseChangedNames(await git(['diff', '--name-status', '-z', '--find-renames', base ?? 'HEAD', '--'])),
    ...parseChangedNames(await git(['diff', '--cached', '--name-status', '-z', '--find-renames', base ?? 'HEAD', '--'])),
    ...(await git(['ls-files', '--others', '--exclude-standard', '-z'])).split('\0').filter(Boolean).map(normalizeChangedPath),
  ])].sort()
  if (selected) {
    warnings.push('显式文件筛选属于局部诊断，不能作为完整验收')
  }
  const fingerprint = createHash('sha256').update(head).update(base ?? '')
  fingerprint.update(await git(['diff', '--cached', '--raw', '-z', base ?? 'HEAD', '--']))
  for (const file of files) {
    options.signal?.throwIfAborted()
    fingerprint.update(`\0${file}\0`)
    try {
      fingerprint.update(await readFile(path.join(root, file), { signal: options.signal }))
    }
    catch (error) {
      options.signal?.throwIfAborted()
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
      fingerprint.update('<deleted>')
    }
  }
  options.signal?.throwIfAborted()
  return { base, head, files, fingerprint: fingerprint.digest('hex'), fallback: !base, warnings }
}
