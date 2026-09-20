import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { x } from 'tinyexec'
import {
  assertRuntimeSizeReport,
  collectRuntimeSizeReport,
  createRuntimeSizePrArtifact,
  readRuntimeSizeReport,
  renderRuntimeSizeMarkdown,
  writeJson,
} from './runtime-size'

export interface RuntimeSizeCliOptions {
  root: string
  build: boolean
  check: boolean
  currentJson?: string
  baselineJson?: string
  outputJson?: string
  outputMarkdown?: string
  artifactJson?: string
  repository?: string
  prNumber?: number
  headSha?: string
  baseSha?: string
  githubSummary: boolean
}

export interface RuntimeSizeCliDependencies {
  appendText: typeof appendFile
  buildRuntimeDependencies: typeof buildRuntimeDependencies
  collectReport: typeof collectRuntimeSizeReport
  ensureParentDirectory: typeof ensureParentDirectory
  readCommit: typeof readCommit
  readReport: typeof readRuntimeSizeReport
  writeJson: typeof writeJson
  writeStdout: (contents: string) => void
  writeText: typeof writeFile
}

function readArgValue(args: readonly string[], name: string) {
  const prefix = `${name}=`
  return args.find(value => value.startsWith(prefix))?.slice(prefix.length)
}

export function parseRuntimeSizeCliOptions(
  args: readonly string[] = process.argv.slice(2),
  cwd = process.cwd(),
): RuntimeSizeCliOptions {
  const prNumberValue = readArgValue(args, '--pr-number')
  return {
    root: path.resolve(cwd, readArgValue(args, '--root') ?? '.'),
    build: args.includes('--build'),
    check: args.includes('--check'),
    currentJson: readArgValue(args, '--current-json'),
    baselineJson: readArgValue(args, '--baseline-json'),
    outputJson: readArgValue(args, '--output-json'),
    outputMarkdown: readArgValue(args, '--output-markdown'),
    artifactJson: readArgValue(args, '--artifact-json'),
    repository: readArgValue(args, '--repository'),
    prNumber: prNumberValue ? Number.parseInt(prNumberValue, 10) : undefined,
    headSha: readArgValue(args, '--head-sha'),
    baseSha: readArgValue(args, '--base-sha'),
    githubSummary: args.includes('--github-summary'),
  }
}

async function ensureParentDirectory(file: string) {
  await mkdir(path.dirname(path.resolve(file)), { recursive: true })
}

async function buildRuntimeDependencies(root: string) {
  const result = await x('pnpm', ['--filter', '@weapp-vite/web...', 'build'], {
    nodeOptions: { cwd: root },
    throwOnError: true,
  })
  process.stdout.write(result.stdout)
  process.stderr.write(result.stderr)
}

async function readCommit(root: string) {
  const result = await x('git', ['-C', root, 'rev-parse', '--short=12', 'HEAD'], { throwOnError: true })
  return result.stdout.trim()
}

function assertArtifactOptions(options: RuntimeSizeCliOptions) {
  if (
    !options.repository
    || !options.prNumber
    || !Number.isSafeInteger(options.prNumber)
    || !options.headSha
    || !options.baseSha
  ) {
    throw new Error('Artifact output requires repository, pr-number, head-sha, and base-sha.')
  }
}

const defaultCliDependencies: RuntimeSizeCliDependencies = {
  appendText: appendFile,
  buildRuntimeDependencies,
  collectReport: collectRuntimeSizeReport,
  ensureParentDirectory,
  readCommit,
  readReport: readRuntimeSizeReport,
  writeJson,
  writeStdout: contents => process.stdout.write(contents),
  writeText: writeFile,
}

export async function runRuntimeSizeCli(
  options: RuntimeSizeCliOptions,
  injectedDependencies: Partial<RuntimeSizeCliDependencies> = {},
) {
  const dependencies = { ...defaultCliDependencies, ...injectedDependencies }
  if (options.build) {
    await dependencies.buildRuntimeDependencies(options.root)
  }

  const current = options.currentJson
    ? await dependencies.readReport(options.currentJson)
    : await dependencies.collectReport({
        root: options.root,
        commit: await dependencies.readCommit(options.root),
      })
  const baseline = options.baselineJson
    ? await dependencies.readReport(options.baselineJson)
    : undefined
  const markdown = renderRuntimeSizeMarkdown(current, baseline)

  if (options.outputJson) {
    await dependencies.ensureParentDirectory(options.outputJson)
    await dependencies.writeJson(options.outputJson, current)
  }
  if (options.outputMarkdown) {
    await dependencies.ensureParentDirectory(options.outputMarkdown)
    await dependencies.writeText(path.resolve(options.outputMarkdown), markdown, 'utf8')
  }
  if (options.artifactJson) {
    assertArtifactOptions(options)
    if (!baseline) {
      throw new Error('Artifact output requires --baseline-json.')
    }
    await dependencies.ensureParentDirectory(options.artifactJson)
    await dependencies.writeJson(options.artifactJson, createRuntimeSizePrArtifact({
      repository: options.repository!,
      prNumber: options.prNumber!,
      headSha: options.headSha!,
      baseSha: options.baseSha!,
      current,
      baseline,
    }))
  }
  if (options.githubSummary && process.env.GITHUB_STEP_SUMMARY) {
    await dependencies.appendText(process.env.GITHUB_STEP_SUMMARY, markdown, 'utf8')
  }
  dependencies.writeStdout(markdown)

  if (options.check) {
    assertRuntimeSizeReport(current)
  }
}

function isDirectRun() {
  return process.argv[1] != null && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
}

if (isDirectRun()) {
  void runRuntimeSizeCli(parseRuntimeSizeCliOptions()).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
