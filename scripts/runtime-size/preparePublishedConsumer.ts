import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { exec } from 'tinyexec'
import { parseAllDocuments, stringify } from 'yaml'
import { createConsumerTemporaryRoot } from '../../packages/weapp-vite/scripts/consumerTarballs.mjs'

const benchmarkCommit = 'ae0ba52baa5db501d8e202b3cec9c4a888a555ff'
const sourceRoot = `https://raw.githubusercontent.com/weapp-vite/benchmarks/${benchmarkCommit}/`
const hash = (content: string) => createHash('sha256').update(content).digest('hex')

async function download(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${url}`)
  }
  return response.text()
}

async function main() {
  // 系统临时根不受仓库祖先 workspace 和 node_modules 解析影响。
  const root = await createConsumerTemporaryRoot()
  process.stderr.write(`Consumer directory: ${root}\n`)
  const originals: Record<string, string> = {}
  const files = ['package.json', 'project.config.json', 'src/app.vue', 'src/pages/detail/index.vue', 'src/pages/index/index.vue', 'src/shared/benchmark.ts', 'src/sitemap.json', 'tsconfig.json', 'weapp-vite.config.ts']
  await Promise.all(files.map(async (file) => {
    const remote = `apps/weapp-vite-wevu/${file}`
    const content = await download(`${sourceRoot}${remote}`)
    originals[remote] = content
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), content)
  }))
  const [lockSource, hook, tsconfig] = await Promise.all([
    download(`${sourceRoot}pnpm-lock.yaml`),
    download(`${sourceRoot}.pnpmfile.cjs`),
    download('https://unpkg.com/repoctl@5.5.10/tsconfig.json'),
  ])
  if (hash(tsconfig) !== '699a3a510a3041fdd181f41fb2db79d395d0dc97618a2fb1d781c7f5381a05b1') {
    throw new Error('Published repoctl 5.5.10 tsconfig does not match the verified npm tarball.')
  }
  originals['pnpm-lock.yaml'] = lockSource
  originals['.pnpmfile.cjs'] = hook
  originals['repoctl@5.5.10/tsconfig.json'] = tsconfig
  const documents = parseAllDocuments(lockSource).map(document => document.toJS() as { importers?: Record<string, unknown>, overrides?: Record<string, string> })
  const lock = documents.find(document => document.importers?.['apps/weapp-vite-wevu'])
  if (!lock) {
    throw new Error('Fixed benchmark lockfile is missing its consumer importer.')
  }
  lock.importers = { '.': lock.importers!['apps/weapp-vite-wevu'] }
  const manifest = JSON.parse(originals['apps/weapp-vite-wevu/package.json']!) as { packageManager?: string }
  manifest.packageManager = 'pnpm@12.8.1'
  const appTsconfig = JSON.parse(originals['apps/weapp-vite-wevu/tsconfig.json']!) as { extends: string }
  appTsconfig.extends = './benchmark-root-tsconfig.json'
  await Promise.all([
    writeFile(path.join(root, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`),
    writeFile(path.join(root, 'pnpm-lock.yaml'), documents.map(document => `---\n${stringify(document)}`).join('')),
    writeFile(path.join(root, 'pnpm-workspace.yaml'), stringify({ packages: ['.'], overrides: lock.overrides })),
    writeFile(path.join(root, '.pnpmfile.cjs'), hook),
    writeFile(path.join(root, 'tsconfig.json'), `${JSON.stringify(appTsconfig, null, 2)}\n`),
    writeFile(path.join(root, 'benchmark-root-tsconfig.json'), `${JSON.stringify({ extends: './repoctl-tsconfig.json', files: [] }, null, 2)}\n`),
    writeFile(path.join(root, 'repoctl-tsconfig.json'), tsconfig),
    writeFile(path.join(root, 'source-provenance.json'), `${JSON.stringify({ repository: 'weapp-vite/benchmarks', commit: benchmarkCommit, sourceHashes: Object.fromEntries(Object.entries(originals).map(([file, content]) => [file, hash(content)])), adaptations: ['app importer relocated to isolated root; dependency snapshots unchanged', 'repoctl 5.5.10 tsconfig materialized from verified published bytes', 'pnpm packageManager pinned to historical 12.8.1'] }, null, 2)}\n`),
  ])
  if (process.argv.includes('--install')) {
    const result = await exec('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], { nodeOptions: { cwd: root }, timeout: 300_000, throwOnError: false })
    process.stderr.write(result.stdout + result.stderr)
    if (result.exitCode !== 0) {
      throw new Error(`Published consumer install failed (${result.exitCode}); preserve the directory for diagnosis.`)
    }
  }
  process.stdout.write(`${root}\n`)
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
