import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { x } from 'tinyexec'
import {
  collectRuntimeSizeReport,
  createRuntimeSizePrArtifact,
  readRuntimeSizeReport,
  renderRuntimeSizeMarkdown,
  writeJson,
} from './runtime-size'

interface CliOptions {
  root: string
  build: boolean
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

function readArgValue(name: string) {
  const prefix = `${name}=`
  return process.argv.slice(2).find(value => value.startsWith(prefix))?.slice(prefix.length)
}

function parseOptions(): CliOptions {
  const prNumberValue = readArgValue('--pr-number')
  return {
    root: path.resolve(readArgValue('--root') ?? process.cwd()),
    build: process.argv.includes('--build'),
    currentJson: readArgValue('--current-json'),
    baselineJson: readArgValue('--baseline-json'),
    outputJson: readArgValue('--output-json'),
    outputMarkdown: readArgValue('--output-markdown'),
    artifactJson: readArgValue('--artifact-json'),
    repository: readArgValue('--repository'),
    prNumber: prNumberValue ? Number.parseInt(prNumberValue, 10) : undefined,
    headSha: readArgValue('--head-sha'),
    baseSha: readArgValue('--base-sha'),
    githubSummary: process.argv.includes('--github-summary'),
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

function assertArtifactOptions(options: CliOptions) {
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

async function main() {
  const options = parseOptions()
  if (options.build) {
    await buildRuntimeDependencies(options.root)
  }

  const current = options.currentJson
    ? await readRuntimeSizeReport(options.currentJson)
    : await collectRuntimeSizeReport({
        root: options.root,
        commit: await readCommit(options.root),
      })
  const baseline = options.baselineJson
    ? await readRuntimeSizeReport(options.baselineJson)
    : undefined
  const markdown = renderRuntimeSizeMarkdown(current, baseline)

  if (options.outputJson) {
    await ensureParentDirectory(options.outputJson)
    await writeJson(options.outputJson, current)
  }
  if (options.outputMarkdown) {
    await ensureParentDirectory(options.outputMarkdown)
    await writeFile(path.resolve(options.outputMarkdown), markdown, 'utf8')
  }
  if (options.artifactJson) {
    assertArtifactOptions(options)
    if (!baseline) {
      throw new Error('Artifact output requires --baseline-json.')
    }
    await ensureParentDirectory(options.artifactJson)
    await writeJson(options.artifactJson, createRuntimeSizePrArtifact({
      repository: options.repository!,
      prNumber: options.prNumber!,
      headSha: options.headSha!,
      baseSha: options.baseSha!,
      current,
      baseline,
    }))
  }
  if (options.githubSummary && process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown, 'utf8')
  }
  process.stdout.write(markdown)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
})
