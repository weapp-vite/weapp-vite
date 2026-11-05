import type { CorpusCaseReport } from '../assertions/corpus'
import type { MatrixCaseReport } from '../assertions/matrix'
import type { collectSyntaxMatrix } from '../assertions/syntax'
import type { FuzzOptions, FuzzReport } from '../fuzz'
import type { EntryContractReport } from './entryContracts'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defaultCorpusReports } from '../paths'

export const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))
export const apiVariants = ['root', 'core'] as const
export type ApiVariant = typeof apiVariants[number]

export interface AcceptanceOptions {
  corpusDirectory?: string
  outputDirectory?: string
  builtEntry?: string
  presetsEntry?: string
  suite?: 'corpus' | 'fuzz' | 'all'
  apiVariant?: ApiVariant
  fuzz?: FuzzOptions
}

export interface AcceptanceReport {
  schemaVersion: 1
  apiVariant: ApiVariant
  startedAt: string
  finishedAt?: string
  accepted: boolean
  runtime: { kind: 'node' | 'chromium', version: string, headless?: true, platform: string, arch: string }
  frozen?: { id: string, manifestSha256: string, contentSha256: string, documents: number, profiles: string[] }
  artifact: AcceptanceArtifact
  presetsArtifact?: AcceptanceArtifact
  baseline?: { name: 'htmlparser2', version: string, entrySha256: string }
  bundle?: { sha256: string, bytes: number }
  entryContract?: EntryContractReport
  presetContract?: EntryContractReport
  corpus?: CorpusCaseReport
  matrix?: MatrixCaseReport
  syntax?: ReturnType<typeof collectSyntaxMatrix>
  fuzz?: FuzzReport
  error?: string
}

export interface AcceptanceArtifact {
  entry: string
  sha256: string
  modules?: Array<{ file: string, sha256: string, bytes: number }>
}

export function sha256(value: Uint8Array | string) {
  return createHash('sha256').update(value).digest('hex')
}

function distributionDirectory(entry: string): string | undefined {
  let directory = path.dirname(entry)
  while (path.basename(directory) !== 'dist' && path.dirname(directory) !== directory) {
    directory = path.dirname(directory)
  }
  return path.basename(directory) === 'dist' ? directory : undefined
}

export function acceptancePaths(options: AcceptanceOptions) {
  const apiVariant = options.apiVariant ?? 'root'
  const builtEntry = path.resolve(options.builtEntry ?? path.join(repositoryRoot, apiVariant === 'root' ? 'packages/wxml/dist/index.mjs' : 'packages/wxml/dist/core/index.mjs'))
  return {
    corpusDirectory: path.resolve(options.corpusDirectory ?? path.join(repositoryRoot, 'packages/wxml/test/corpus')),
    outputDirectory: path.resolve(options.outputDirectory ?? path.join(defaultCorpusReports, options.suite ?? 'all')),
    builtEntry,
    presetsEntry: path.resolve(options.presetsEntry ?? path.join(distributionDirectory(builtEntry) ?? path.join(repositoryRoot, 'packages/wxml/dist'), 'presets/index.mjs')),
    suite: options.suite ?? 'all',
    apiVariant,
  }
}

export async function saveAcceptance(report: AcceptanceReport, outputDirectory: string) {
  await mkdir(outputDirectory, { recursive: true })
  const file = `${report.runtime.kind}-${report.apiVariant}.json`
  await writeFile(path.join(outputDirectory, file), `${JSON.stringify(report, null, 2)}\n`)
  const failures = [...report.entryContract?.failures ?? [], ...report.presetContract?.failures ?? [], ...report.corpus?.failures ?? [], ...report.matrix?.failures ?? [], ...report.syntax?.failures ?? [], ...report.fuzz?.failures ?? []]
  await writeFile(path.join(outputDirectory, `${report.runtime.kind}-${report.apiVariant}-failures.jsonl`), failures.map(failure => JSON.stringify(failure)).join('\n') + (failures.length ? '\n' : ''))
}

/** 构建入口可能只是共享 chunk 的转发文件，冻结整个 dist 防止遗漏实际运行代码。 */
export async function builtModuleInventory(entry: string): Promise<NonNullable<AcceptanceReport['artifact']['modules']>> {
  const directory = distributionDirectory(entry)
  if (!directory) {
    const bytes = await readFile(entry)
    return [{ file: path.basename(entry), sha256: sha256(bytes), bytes: bytes.length }]
  }
  const base = directory
  const files: NonNullable<AcceptanceReport['artifact']['modules']> = []
  const visit = async (directory: string) => {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, item.name)
      if (item.isSymbolicLink()) {
        throw new TypeError('Built acceptance artifacts cannot follow symbolic links.')
      }
      if (item.isDirectory()) {
        await visit(file)
      }
      else if (item.isFile() && /\.(?:mjs|cjs|js|mts|cts|ts)$/.test(item.name)) {
        const bytes = await readFile(file)
        files.push({ file: path.relative(base, file).split(path.sep).join('/'), sha256: sha256(bytes), bytes: bytes.length })
      }
    }
  }
  await visit(base)
  return files.sort((left, right) => left.file.localeCompare(right.file, 'en'))
}

/** 入口与共享 chunk 同时冻结；替代 --entry 仍可单独选择自己的 presets 入口。 */
export async function acceptanceArtifact(entry: string): Promise<AcceptanceArtifact> {
  return { entry: path.relative(repositoryRoot, entry).split(path.sep).join('/'), sha256: sha256(await readFile(entry)), modules: await builtModuleInventory(entry) }
}

export async function assertArtifactIdentity(entry: string, expected: AcceptanceArtifact) {
  if (JSON.stringify(await acceptanceArtifact(entry)) !== JSON.stringify(expected)) {
    throw new Error('Frozen acceptance artifact or module inventory changed during acceptance.')
  }
}

export async function assertFrozenIdentity(manifestPath: string, manifestHash: string, entry: string, entryHash: string, modules?: AcceptanceReport['artifact']['modules']) {
  if (sha256(await readFile(manifestPath)) !== manifestHash || sha256(await readFile(entry)) !== entryHash) {
    throw new Error('Frozen manifest or built entry changed during acceptance.')
  }
  if (modules && JSON.stringify(await builtModuleInventory(entry)) !== JSON.stringify(modules)) {
    throw new Error('Frozen built module inventory changed during acceptance.')
  }
}

export function commandLineOptions(arguments_: string[]): AcceptanceOptions {
  const options: AcceptanceOptions = {}
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index]
    const value = arguments_[index + 1]
    if (!value) {
      throw new TypeError(`Missing value for ${name}`)
    }
    if (name === '--corpus') {
      options.corpusDirectory = value
    }
    else if (name === '--output') {
      options.outputDirectory = value
    }
    else if (name === '--entry') {
      options.builtEntry = value
    }
    else if (name === '--presets-entry') {
      options.presetsEntry = value
    }
    else if (name === '--api-variant' && apiVariants.includes(value as ApiVariant)) {
      options.apiVariant = value as ApiVariant
    }
    else if (name === '--suite' && ['all', 'corpus', 'fuzz'].includes(value)) {
      options.suite = value as AcceptanceOptions['suite']
    }
    else if (['--valid', '--invalid', '--edits', '--seed'].includes(name!)) {
      const key = name === '--edits' ? 'editSequences' : name!.slice(2) as 'valid' | 'invalid' | 'seed'
      ;(options.fuzz ??= {})[key] = Number(value)
    }
    else {
      throw new TypeError(`Unknown corpus acceptance option: ${name}`)
    }
  }
  return options
}

export function isDirectExecution(url: string) {
  return Boolean(process.argv[1] && url === pathToFileURL(process.argv[1]).href)
}
