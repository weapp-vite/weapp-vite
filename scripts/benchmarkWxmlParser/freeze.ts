import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { SAMPLING_CONTRACT } from './contracts'

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const baselineRoot = path.join(repositoryRoot, '.tmp/current-run/wxml/baseline')
export const consumerEntries = {
  scanner: 'packages/weapp-vite/src/wxml/scan/parser.ts',
  web: 'packages-runtime/web/src/compiler/wxml/parser.ts',
  simulator: 'mpcore/packages/simulator/src/view/wxsDocument.ts',
} as const
export const hash = (source: string | Uint8Array) => createHash('sha256').update(source).digest('hex')

export interface Policy {
  schemaVersion: number
  samplingContract: typeof SAMPLING_CONTRACT
  baselineRef: string
  corpusRoots: string[]
  extensions: Record<string, string>
  expectedDocuments: number
  corpusSha256: string
  features: { denseAttributeMinimum: number, scriptTags: string[], webTags: string[] }
  pressure: { depths: number[], textBytes: number[], entityElements: number[] }
}

export async function readPolicy(): Promise<Policy> {
  const policy = JSON.parse(await readFile(path.join(repositoryRoot, 'scripts/benchmarkWxmlParser/policy.json'), 'utf8')) as Policy
  if (policy.samplingContract !== SAMPLING_CONTRACT) {
    throw new Error('Benchmark policy differs from the parser workload contract.')
  }
  return policy
}

export interface CorpusEntry {
  id: string
  bytes: number
  sha256: string
  origins: string[]
  platform: string
  cohort: 'shared' | 'wxml'
  size: 'small' | 'medium' | 'large'
}

export interface BaselineManifest {
  schemaVersion: 1
  commit: string
  lockSha256: string
  files: CorpusEntry[]
  artifacts: Record<string, string>
  sources: Record<string, string>
}

export function classify(source: string): CorpusEntry['cohort'] {
  return /<(?:wxs|sjs|filter)\b|\\["']|\{\{(?:(?!\}\})[\s\S])*<|\{\{(?:(?!\}\})[\s\S])*['"]\}\}/.test(source) ? 'wxml' : 'shared'
}

export async function freezeBaseline(output = baselineRoot, ref?: string) {
  const policy = await readPolicy()
  const git = (args: string[]) => execFileSync('git', args, { cwd: repositoryRoot, maxBuffer: 64 * 1024 * 1024 })
  const commit = git(['rev-parse', `${ref ?? policy.baselineRef}^{commit}`]).toString().trim()
  if (commit !== policy.baselineRef) {
    throw new Error('Baseline ref must match the reviewed benchmark policy.')
  }
  await mkdir(output, { recursive: false })
  await mkdir(path.join(output, 'corpus'))
  const tracked = git(['ls-tree', '-r', '--name-only', '-z', commit]).toString().split('\0').filter(Boolean)
  const sourceAtHead = (file: string) => git(['show', `${commit}:${file}`])
  const files: CorpusEntry[] = []
  const duplicates = new Map<string, CorpusEntry>()
  for (const file of tracked.filter(file => policy.corpusRoots.some(root => file.startsWith(`${root}/`))
    && policy.extensions[path.extname(file)]).sort()) {
    const source = sourceAtHead(file)
    const sha256 = hash(source)
    const existing = duplicates.get(sha256)
    if (existing) {
      existing.origins.push(file)
      continue
    }
    const row: CorpusEntry = {
      id: sha256,
      sha256,
      bytes: source.length,
      origins: [file],
      platform: policy.extensions[path.extname(file)]!,
      cohort: classify(source.toString()),
      size: source.length < 2048 ? 'small' : source.length < 16384 ? 'medium' : 'large',
    }
    files.push(row)
    duplicates.set(sha256, row)
    await writeFile(path.join(output, 'corpus', `${sha256}.txt`), source)
  }
  if (!files.length) {
    throw new Error('No tracked native templates were found.')
  }
  if (files.length !== policy.expectedDocuments || hash(JSON.stringify(files)) !== policy.corpusSha256) {
    throw new Error('Frozen corpus differs from the reviewed complete corpus; do not remove or reclassify inputs.')
  }
  const sources: Record<string, string> = {}
  const artifacts: Record<string, string> = {}
  const trackedSet = new Set(tracked)
  for (const [name, entry] of Object.entries(consumerEntries)) {
    const outfile = path.join(output, `${name}.mjs`)
    await build({
      entryPoints: [path.join(repositoryRoot, entry)],
      outfile,
      bundle: true,
      format: 'esm',
      platform: 'node',
      packages: 'external',
      logLevel: 'silent',
      plugins: [{
        name: 'frozen-head-source',
        setup(builder) {
          const frozen = (absolute: string) => {
            const relative = path.relative(repositoryRoot, absolute).replaceAll('\\', '/')
            const candidates = [relative, ...['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.js'].map(suffix => relative + suffix)]
            const match = candidates.find(candidate => trackedSet.has(candidate))
            return match ? { path: path.join(repositoryRoot, match), namespace: 'git-snapshot' } : undefined
          }
          builder.onResolve({ filter: /^@weapp-vite\/language-service$/ }, () => frozen(path.join(repositoryRoot, 'packages/language-service/src/template/scanner.ts')))
          builder.onResolve({ filter: /^@weapp-vite\/ast$/ }, () => frozen(path.join(repositoryRoot, 'packages/ast/src/babel.ts')))
          builder.onResolve({ filter: /^wevu\/compiler$/ }, () => frozen(path.join(repositoryRoot, 'packages-runtime/wevu-compiler/src/auto-import-components/builtin.ts')))
          builder.onResolve({ filter: /^@weapp-core\/shared(?:\/platforms(?:\/runtime)?)?$/ }, args => frozen(
            path.join(repositoryRoot, '@weapp-core/shared/src', args.path.endsWith('/runtime') ? 'platforms/runtime/index.ts' : args.path.endsWith('/platforms') ? 'platforms/index.ts' : 'index.ts'),
          ))
          builder.onResolve({ filter: /^(?:\.|\/|[A-Z]:[\\/])/i }, args => frozen(path.resolve(args.resolveDir || path.dirname(args.importer), args.path)))
          builder.onLoad({ filter: /.*/, namespace: 'git-snapshot' }, (args) => {
            const relative = path.relative(repositoryRoot, args.path).replaceAll('\\', '/')
            const contents = sourceAtHead(relative).toString()
            sources[relative] = hash(contents)
            return { contents, resolveDir: path.dirname(args.path), loader: relative.endsWith('.tsx') ? 'tsx' : /\.[cm]?ts$/.test(relative) ? 'ts' : relative.endsWith('.json') ? 'json' : 'js' }
          })
        },
      }],
    })
    artifacts[`${name}.mjs`] = hash(await readFile(outfile))
  }
  const manifest: BaselineManifest = {
    schemaVersion: 1,
    commit,
    files,
    sources,
    artifacts,
    lockSha256: hash(sourceAtHead('pnpm-lock.yaml')),
  }
  await writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const refIndex = args.indexOf('--ref')
  const outputIndex = args.indexOf('--output')
  if ((refIndex >= 0 && !args[refIndex + 1]) || (outputIndex >= 0 && !args[outputIndex + 1])) {
    throw new Error('--ref and --output require values.')
  }
  const output = outputIndex < 0 ? baselineRoot : path.resolve(repositoryRoot, args[outputIndex + 1]!)
  await mkdir(path.dirname(output), { recursive: true })
  const manifest = await freezeBaseline(output, refIndex < 0 ? undefined : args[refIndex + 1])
  process.stdout.write(`Frozen ${manifest.files.length} unique templates from ${manifest.commit}\n`)
}
