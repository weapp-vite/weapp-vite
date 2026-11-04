import type { GitHubClient, GitTreeEntry } from '../collect/github'
import type { CorpusSource } from '../types'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import micromatch from 'micromatch'
import { corpusHash, corpusJson } from '../archive'
import { collectSourceAttribution } from '../collect/attribution'
import { createGitHubClient, readCompleteTree } from '../collect/github'
import { licenseFileBytes, resolveTemplateLicense } from '../license'
import { writeProjectFile } from './files'

export interface FreezeFrameworkInputOptions {
  source: Pick<CorpusSource, 'repository' | 'commit' | 'license' | 'independentRepository'>
  prefix: string
  include?: string[]
  exclude?: string[]
  outputDir: string
  cacheDir: string
  client?: GitHubClient
  concurrency?: number
}

export interface InputProjection {
  path: string
  gitSha: string
  selected: boolean
  destination?: string
  sha256?: string
  bytes?: number
  reason?: string
}

function safeRelative(file: string): boolean {
  return Boolean(file && !file.startsWith('/') && !file.includes('\\') && !file.split('/').some(part => part === '..' || part === '.'))
}

function projectionReason(entry: GitTreeEntry, prefix: string, exclusions: string[], inclusions?: string[]): { file?: string, reason?: string } {
  assert.ok(safeRelative(entry.path), 'Nonportable input source path')
  if (prefix && !entry.path.startsWith(`${prefix}/`)) {
    return { reason: 'outside-selected-source-prefix' }
  }
  const file = prefix ? entry.path.slice(prefix.length + 1) : entry.path
  if (entry.mode === '120000') {
    return { reason: 'git-symbolic-link' }
  }
  if (file.split('/').some(part => ['.git', 'node_modules'].includes(part))) {
    return { reason: 'repository-or-dependency-directory' }
  }
  if (/^(?:\.(?:babelrc|npmrc|pnpmfile)|(?:babel|postcss|vite|rollup|webpack|vue)\.config\.)/.test(path.posix.basename(file))) {
    return { reason: 'executable-upstream-tool-configuration' }
  }
  if (inclusions && !inclusions.some(pattern => micromatch.isMatch(file, pattern, { dot: true }))) {
    return { reason: 'outside-selected-input-patterns' }
  }
  const excluded = exclusions.find(pattern => micromatch.isMatch(file, pattern, { dot: true }))
  return excluded ? { reason: `explicit-exclusion:${excluded}` } : { file }
}

/** 完整树先冻结再投影源码，静态资源保留；所有排除项均具有可审计原因。 */
export async function freezeFrameworkInput(options: FreezeFrameworkInputOptions) {
  assert.ok(typeof options.prefix === 'string', 'Input source prefix must be explicit')
  const prefix = options.prefix.replace(/\/$/, '')
  assert.ok(!prefix || safeRelative(prefix), 'Unsafe controlled input prefix')
  const concurrency = options.concurrency ?? 8
  assert.ok(Number.isSafeInteger(concurrency) && concurrency > 0, 'Invalid input download concurrency')
  const client = options.client ?? createGitHubClient({ cacheDir: options.cacheDir })
  const tree = await readCompleteTree(client, options.source.repository, options.source.commit)
  const license = await collectSourceAttribution(options.source, tree, client, concurrency)
  const identity = { repository: options.source.repository, commit: options.source.commit, licenseId: license.id }
  const configuration = { source: options.source, prefix, include: options.include, exclude: options.exclude ?? [] }
  const id = corpusHash(corpusJson(configuration)).slice(0, 24)
  const directory = path.join(options.outputDir, `input-${id}`)
  const projections: InputProjection[] = []
  const selected: Array<{ entry: GitTreeEntry, file: string, projection: InputProjection }> = []
  const portableNames = new Set<string>()
  for (const entry of tree) {
    const match = projectionReason(entry, prefix, options.exclude ?? [], options.include)
    const projection: InputProjection = { path: entry.path, gitSha: entry.sha, selected: Boolean(match.file), destination: match.file, reason: match.reason }
    projections.push(projection)
    if (match.file) {
      const permission = resolveTemplateLicense(entry.path, license)
      assert.ok(permission.confirmed, `Controlled input license is unconfirmed for ${entry.path}: ${permission.reason}`)
      const portableName = match.file.normalize('NFC').toLocaleLowerCase('en')
      assert.ok(!portableNames.has(portableName), 'Input source paths collide on case-insensitive filesystems')
      portableNames.add(portableName)
      selected.push({ entry, file: match.file, projection })
    }
  }
  assert.ok(selected.length, 'Source projection selected no input files')
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, async () => {
    while (cursor < selected.length) {
      const current = selected[cursor++]!
      const bytes = await client.blob(options.source.repository, options.source.commit, current.entry)
      const sha256 = corpusHash(bytes)
      try {
        const previous = await readFile(path.join(directory, 'src', current.file))
        assert.equal(corpusHash(previous), sha256, 'Previously frozen controlled source changed')
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error
        }
        await writeProjectFile(directory, `src/${current.file}`, bytes)
      }
      current.projection.sha256 = sha256
      current.projection.bytes = bytes.length
    }
  }))
  for (const file of license.files) {
    await writeProjectFile(directory, `attribution/${file.path}`, licenseFileBytes(file))
  }
  await writeProjectFile(directory, 'identity.json', `${corpusJson(identity)}\n`)
  await writeProjectFile(directory, 'source-tree.json', `${corpusJson(tree)}\n`)
  await writeProjectFile(directory, 'input-metadata.json', `${corpusJson({
    schemaVersion: 1,
    id,
    configuration,
    identity,
    treeSha256: corpusHash(corpusJson(tree)),
    treeFiles: tree.length,
    selectedFiles: selected.length,
    projection: projections,
    repositories: [{
      repository: options.source.repository,
      commit: options.source.commit,
      independentRepository: options.source.independentRepository ?? options.source.repository,
      licenseId: license.id,
      treeSha256: corpusHash(corpusJson(tree)),
      treeFiles: tree.length,
      selectedFiles: selected.length,
      excludedFiles: projections.length - selected.length,
      complete: true,
    }],
    licenses: [license],
    complete: true,
  })}\n`)
  return { id, directory, identity, treeFiles: tree.length, selectedFiles: selected.length }
}
