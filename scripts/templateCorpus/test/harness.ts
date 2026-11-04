import type { CorpusCaseReport } from '../assertions/corpus'
import type { MatrixCaseReport } from '../assertions/matrix'
import type { collectSyntaxMatrix } from '../assertions/syntax'
import type { FuzzOptions, FuzzReport } from '../fuzz'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defaultCorpusReports } from '../paths'

export const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))
export interface AcceptanceOptions {
  corpusDirectory?: string
  outputDirectory?: string
  builtEntry?: string
  suite?: 'corpus' | 'fuzz' | 'all'
  fuzz?: FuzzOptions
}

export interface AcceptanceReport {
  schemaVersion: 1
  startedAt: string
  finishedAt?: string
  accepted: boolean
  runtime: { kind: 'node' | 'chromium', version: string, headless?: true, platform: string, arch: string }
  frozen?: { id: string, manifestSha256: string, contentSha256: string, documents: number, profiles: string[] }
  artifact: { entry: string, sha256: string }
  baseline?: { name: 'htmlparser2', version: string, entrySha256: string }
  bundle?: { sha256: string, bytes: number }
  corpus?: CorpusCaseReport
  matrix?: MatrixCaseReport
  syntax?: ReturnType<typeof collectSyntaxMatrix>
  fuzz?: FuzzReport
  error?: string
}

export function sha256(value: Uint8Array | string) {
  return createHash('sha256').update(value).digest('hex')
}

export function acceptancePaths(options: AcceptanceOptions) {
  return {
    corpusDirectory: path.resolve(options.corpusDirectory ?? path.join(repositoryRoot, 'packages/wxml/test/corpus')),
    outputDirectory: path.resolve(options.outputDirectory ?? path.join(defaultCorpusReports, options.suite ?? 'all')),
    builtEntry: path.resolve(options.builtEntry ?? path.join(repositoryRoot, 'packages/wxml/dist/index.mjs')),
    suite: options.suite ?? 'all',
  }
}

export async function saveAcceptance(report: AcceptanceReport, outputDirectory: string) {
  await mkdir(outputDirectory, { recursive: true })
  const file = `${report.runtime.kind}.json`
  await writeFile(path.join(outputDirectory, file), `${JSON.stringify(report, null, 2)}\n`)
  const failures = [...report.corpus?.failures ?? [], ...report.matrix?.failures ?? [], ...report.syntax?.failures ?? [], ...report.fuzz?.failures ?? []]
  await writeFile(path.join(outputDirectory, `${report.runtime.kind}-failures.jsonl`), failures.map(failure => JSON.stringify(failure)).join('\n') + (failures.length ? '\n' : ''))
}

export async function assertFrozenIdentity(manifestPath: string, manifestHash: string, entry: string, entryHash: string) {
  if (sha256(await readFile(manifestPath)) !== manifestHash || sha256(await readFile(entry)) !== entryHash) {
    throw new Error('Frozen manifest or built entry changed during acceptance.')
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
