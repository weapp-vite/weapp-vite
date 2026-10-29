import type { FileWatchEngine } from '../../src/runtime/watch/fileWatcher'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { x } from 'tinyexec'

const repository = path.resolve(import.meta.dirname, '../../../..')
const require = createRequire(import.meta.url)
const names = { chokidar: 'chokidar', parcel: '@parcel/watcher' } as const

function hash(contents: string | Uint8Array) {
  return createHash('sha256').update(contents).digest('hex')
}

function relative(file: string) {
  return path.relative(repository, file).replaceAll('\\', '/')
}

async function sourceIdentity(directory: string) {
  const files: Array<{ file: string, sha256: string }> = []
  const visit = async (current: string) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await visit(file)
      }
      else if (entry.isFile()) {
        files.push({ file: relative(file), sha256: hash(await readFile(file)) })
      }
    }
  }
  await visit(directory)
  files.sort((left, right) => left.file < right.file ? -1 : left.file > right.file ? 1 : 0)
  return { directory: relative(directory), sha256: hash(JSON.stringify(files)), files }
}

async function gitIdentity() {
  try {
    const options = { nodeOptions: { cwd: repository, shell: false }, throwOnError: false } as const
    const [revision, status] = await Promise.all([
      x('git', ['rev-parse', 'HEAD'], options),
      x('git', ['status', '--porcelain=v1', '--untracked-files=all'], options),
    ])
    if (revision.exitCode === 0 && status.exitCode === 0) {
      return { status: 'observed', head: revision.stdout.trim(), dirty: status.stdout.trim().length > 0 }
    }
  }
  catch {}
  return { status: 'not-observed', head: null, dirty: null }
}

async function dependencyIdentity(engine: FileWatchEngine) {
  const name = names[engine]
  const entry = require.resolve(name)
  let directory = path.dirname(entry)
  for (;;) {
    const metadata = await readFile(path.join(directory, 'package.json'), 'utf8')
      .then(value => JSON.parse(value) as { name?: unknown, version?: unknown })
      .catch(() => undefined)
    if (metadata?.name === name && typeof metadata.version === 'string') {
      const entryFile = path.relative(directory, entry).replaceAll('\\', '/')
      const artifacts = engine === 'chokidar'
        ? ['index.js', 'backend.js', 'policy.js', 'reconcile.js', 'runtime.js', 'tree.js', 'package.json']
        : [entryFile, 'package.json']
      const files = Object.fromEntries(await Promise.all(artifacts.map(async file => [file, hash(await readFile(path.join(directory, file)))] as const)))
      const patchFile = 'patches/chokidar@6.0.0.patch'
      return {
        name,
        version: metadata.version,
        entry: { file: entryFile, sha256: files[entryFile] ?? hash(await readFile(entry)) },
        files,
        ...(engine === 'chokidar' ? { patchBaseline: { version: '6.0.0', file: patchFile, sha256: hash(await readFile(path.join(repository, patchFile))) } } : {}),
        ...(engine === 'parcel' ? { nativeBinding: { status: 'not-observed', reason: 'The public API does not expose the selected native binding identity; JavaScript package identity only.' } } : {}),
      }
    }
    const parent = path.dirname(directory)
    if (parent === directory) {
      throw new Error(`Could not locate installed package metadata for ${name}`)
    }
    directory = parent
  }
}

/** 从实际解析的安装文件和当前源码取得基线，不加载私有原生绑定或执行 watcher。 */
export async function watcherComparisonIdentity(engines: FileWatchEngine[]) {
  const [git, tool, adapter, lockfileSha256, dependencies] = await Promise.all([
    gitIdentity(),
    sourceIdentity(import.meta.dirname),
    sourceIdentity(path.resolve(import.meta.dirname, '../../src/runtime/watch/fileWatcher')),
    readFile(path.join(repository, 'pnpm-lock.yaml')).then(hash),
    Promise.all(engines.map(async engine => [engine, await dependencyIdentity(engine)] as const)),
  ])
  return { git, source: { tool, adapter }, lockfileSha256, dependencies: Object.fromEntries(dependencies) }
}
