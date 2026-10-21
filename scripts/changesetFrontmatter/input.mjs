import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const isChangeset = name => name.endsWith('.md') && name !== 'README.md' && !name.includes('/')

/** 暂存模式只读取本次提交的索引 blob；工作树模式保留 CI 全量检查。 */
export function readChangesetInput(directory, staged) {
  if (!staged) {
    return {
      changesets: readdirSync(path.join(directory, '.changeset'), { withFileTypes: true }).filter(entry => entry.isFile() && isChangeset(entry.name)).map(entry => entry.name),
      read: file => readFileSync(path.join(directory, file), 'utf8'),
      exists: file => existsSync(path.join(directory, file)),
      directories: file => readdirSync(path.join(directory, file), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name),
    }
  }

  const git = (args, cwd = directory) => execFileSync('git', ['-c', 'core.fsmonitor=false', ...args], { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  const root = git(['rev-parse', '--show-toplevel']).trim()
  const changed = git(['diff', '--cached', '--no-renames', '--name-only', '--diff-filter=ACMTU', '-z', '--', '.changeset'], root)
    .split('\0')
    .filter(Boolean)
  const changesets = changed.filter(file => file.startsWith('.changeset/') && isChangeset(file.slice('.changeset/'.length))).map(file => file.slice('.changeset/'.length))
  // 无 changeset 变更时不扫描其他文件，也不要求未暂存的 workspace 配置可读。
  const files = changesets.length ? git(['ls-files', '--cached', '-z'], root).split('\0').filter(Boolean) : []
  const indexed = new Set(files)
  return {
    changesets,
    read: file => git(['show', `:${file}`], root),
    exists: file => indexed.has(file) || files.some(candidate => candidate.startsWith(`${file}/`)),
    directories: file => [...new Set(files.filter(candidate => candidate.startsWith(`${file}/`)).map(candidate => candidate.slice(file.length + 1).split('/')).filter(parts => parts.length > 1).map(parts => parts[0]))],
  }
}
