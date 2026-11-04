import type { CorpusDocument, CorpusGeneration } from '../types'
import type { GenerationEvidence, GenerationOptions } from './types'
import assert from 'node:assert/strict'
import { mkdir, open, readdir, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { corpusJson } from '../archive'
import { getCorpusProfile } from '../profiles'
import { readFrameworkCatalog, selectFrameworkTarget } from './catalog'
import { copyControlledInput, fileIdentity, listOutputFiles, listProjectFiles, outputFileIdentity, writeProjectFile } from './files'
import { collectGeneratedDocuments } from './output'
import { createControlledProject, generationInputKey, validateGenerationIdentity } from './project'

export interface GenerationResult {
  directory: string
  generations: CorpusGeneration[]
  documents: CorpusDocument[]
  matrixTemplates: MatrixFixtureTemplate[]
}

export interface MatrixFixtureTemplate {
  source: string
  sha256: string
  path: string
  platform: string
  profileId: string
  generationId: string
  fixtureId: string
  quotaEligible: false
}

/** 自产夹具转换为无来源成员的独立结构，从真实语料入口剔除。 */
export function retainGeneratedTemplates(result: GenerationResult, documents: CorpusDocument[], fixtureId?: string) {
  if (!fixtureId) {
    result.documents.push(...documents)
    return
  }
  result.matrixTemplates.push(...documents.map(document => ({
    source: document.source,
    sha256: document.sha256,
    path: document.origins[0]!.path,
    platform: document.origins[0]!.platform,
    profileId: document.origins[0]!.profileId,
    generationId: document.origins[0]!.generationId!,
    fixtureId,
    quotaEligible: false as const,
  })))
}

function sanitizeLog(source: string, locations: string[]): string {
  let output = source.replace(/\r\n/g, '\n')
  for (const location of locations.filter(Boolean).sort((a, b) => b.length - a.length)) {
    output = output.split(location).join('<controlled-workspace>')
  }
  return output
}

async function runCommand(command: string[], project: string, environment: Record<string, string>, log: string) {
  const destination = path.join(project, log)
  await mkdir(path.dirname(destination), { recursive: true })
  const handle = await open(destination, 'wx')
  try {
    const result = await execa(command[0]!, command.slice(1), {
      cwd: project,
      env: { ...environment, npm_config_userconfig: path.join(project, '.npmrc'), npm_config_registry: 'https://registry.npmjs.org/' },
      all: true,
      reject: false,
      timeout: 900_000,
      maxBuffer: 64 * 1024 * 1024,
    })
    const output = sanitizeLog(result.all ?? '', [project, process.cwd(), os.homedir()])
    await handle.writeFile(`${output}\nexitCode=${result.exitCode ?? 'none'} timedOut=${result.timedOut}\n`)
    assert.ok(result.exitCode === 0 && !result.timedOut, `Controlled command failed; see ${log}`)
  }
  finally {
    await handle.close()
  }
}

/** 依据已有目录身份分配下一轮，原子预留目录且不复用任何历史日志。 */
async function reserveAttemptDirectory(project: string): Promise<string> {
  const directory = path.join(project, 'evidence')
  await mkdir(directory, { recursive: true })
  let attempt = 1
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const match = /^attempt-([1-9]\d*)$/.exec(entry.name)
    if (!match) {
      continue
    }
    assert.ok(entry.isDirectory() && !entry.isSymbolicLink(), 'Generation attempt identity must be an ordinary directory')
    const previous = Number(match[1])
    assert.ok(Number.isSafeInteger(previous) && Number.isSafeInteger(previous + 1), 'Invalid generation attempt number')
    attempt = Math.max(attempt, previous + 1)
  }
  while (true) {
    const relative = `evidence/attempt-${attempt}`
    try {
      await mkdir(path.join(project, relative))
      return relative
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error
      }
      attempt += 1
      assert.ok(Number.isSafeInteger(attempt), 'Invalid generation attempt number')
    }
  }
}

async function readPrevious(project: string, file: string): Promise<GenerationEvidence | undefined> {
  try {
    const value: unknown = JSON.parse(await readFile(path.join(project, file), 'utf8'))
    assert.ok(value && typeof value === 'object' && 'schemaVersion' in value && value.schemaVersion === 1, 'Invalid previous generation evidence')
    return value as GenerationEvidence
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}

async function listEvidenceFiles(project: string): Promise<string[]> {
  try {
    return (await listProjectFiles(path.join(project, 'evidence'))).map(file => `evidence/${file}`)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
    return []
  }
}

async function verifyPrevious(project: string, evidence: GenerationEvidence) {
  for (const identity of [...evidence.configuration, ...evidence.dependencies, ...evidence.logs]) {
    assert.equal(corpusJson(await fileIdentity(project, identity.file)), corpusJson(identity), 'Frozen generation evidence changed')
  }
  for (const identity of evidence.outputs) {
    assert.equal(corpusJson(await outputFileIdentity(project, identity.file, evidence.mode)), corpusJson(identity), 'Frozen generation output changed')
  }
  assert.deepEqual((await listOutputFiles(project, evidence.mode)).sort(), evidence.outputs.map(identity => identity.file).sort(), 'Frozen generation output inventory changed')
  for (const identity of evidence.input) {
    assert.equal((await fileIdentity(project, `src/${identity.file}`)).sha256, identity.sha256, 'Frozen generation input changed')
  }
}

/** 每格独立保留失败与完整产物证据；续行仅复用哈希仍一致的成功结果。 */
export async function generateFramework(options: GenerationOptions): Promise<GenerationResult> {
  validateGenerationIdentity(options.identity)
  assert.ok(options.controlledFixtureId === undefined || /^[a-z\d][\w.-]+$/.test(options.controlledFixtureId), 'Invalid controlled fixture identity')
  const selected = selectFrameworkTarget(await readFrameworkCatalog(), options.framework, options.version, options.target)
  if (selected.release.upstream && !options.controlledFixtureId) {
    assert.equal(options.identity.repository, selected.release.upstream.repository, 'Framework input repository does not match its frozen upstream')
    assert.equal(options.identity.commit, selected.release.upstream.commit, 'Framework input commit does not match its frozen upstream')
  }
  getCorpusProfile(selected.target.profileId)
  const modes = options.modes ?? ['development', 'production']
  assert.ok(modes.length && new Set(modes).size === modes.length && modes.every(mode => ['development', 'production'].includes(mode)), 'Invalid generation modes')
  const inputFiles = await listProjectFiles(options.input)
  const input = await Promise.all(inputFiles.map(file => fileIdentity(options.input, file)))
  const controlled = createControlledProject(selected.release, selected.target, options.inputDependencies)
  const inputKey = generationInputKey(options.identity, { input, controlled, controlledFixtureId: options.controlledFixtureId })
  const name = `${options.framework}-${options.version}-${options.target}-${inputKey}`
  const project = path.resolve(options.workspace, name)
  await mkdir(project, { recursive: true })
  const packageManager = (await execa('pnpm', ['--version'])).stdout.trim()
  const result: GenerationResult = { directory: project, generations: [], documents: [], matrixTemplates: [] }
  const configuration = Object.keys(controlled.files).sort()
  const install = ['pnpm', 'install', '--ignore-scripts', '--no-frozen-lockfile', '--registry=https://registry.npmjs.org/']
  let installation: { success: true } | { success: false, error: unknown } | undefined
  let attemptDirectory: string | undefined
  for (const mode of modes) {
    const id = `${name}-${mode}`
    const report = `evidence/${mode}.json`
    const previous = await readPrevious(project, report)
    const output = `out/${mode}`
    const command = controlled.command.map(argument => argument === '{mode}' ? mode : argument === '{output}' ? output : argument)
    let evidence: GenerationEvidence = {
      schemaVersion: 1,
      id,
      framework: options.framework,
      version: options.version,
      target: options.target,
      mode,
      source: options.identity,
      inputDependencies: options.inputDependencies ?? {},
      provenance: options.controlledFixtureId ? { kind: 'controlled-fixture', fixtureId: options.controlledFixtureId, quotaEligible: false } : undefined,
      runtime: { node: process.version, packageManager: `pnpm@${packageManager}` },
      input,
      configuration: [],
      dependencies: [],
      outputs: [],
      logs: [],
      commands: [install, command],
      status: selected.target.support === 'unsupported' ? 'unsupported' : 'pending',
      reason: selected.target.support === 'unsupported' ? selected.target.evidence : undefined,
    }
    if (previous?.status === 'built') {
      assert.equal(previous.id, id, 'Previous generation identity mismatch')
      await verifyPrevious(project, previous)
      evidence = previous
      retainGeneratedTemplates(result, await collectGeneratedDocuments(project, output, selected.target, evidence), options.controlledFixtureId)
    }
    else {
      assert.ok(!previous || previous.status !== 'failed' || !options.execute || options.retry, 'Previous failure retained; use --retry to explicitly record another attempt')
      if (previous?.status === 'failed' && options.retry) {
        const history = `evidence/history/${mode}-${(await listProjectFiles(path.join(project, 'evidence'))).length}.json`
        await writeProjectFile(project, history, `${corpusJson(previous)}\n`)
      }
      await copyControlledInput(options.input, project)
      for (const [file, source] of Object.entries(controlled.files)) {
        await writeProjectFile(project, file, source)
      }
      evidence.configuration = await Promise.all(configuration.map(file => fileIdentity(project, file)))
      if (options.execute && evidence.status !== 'unsupported') {
        attemptDirectory ??= await reserveAttemptDirectory(project)
        try {
          if (!installation) {
            try {
              await runCommand(install, project, {}, `${attemptDirectory}/install.log`)
              installation = { success: true }
            }
            catch (error) {
              installation = { success: false, error }
            }
          }
          if (!installation.success) {
            throw installation.error
          }
          evidence.dependencies = [await fileIdentity(project, 'pnpm-lock.yaml')]
          await rm(path.join(project, output), { recursive: true, force: true })
          await runCommand(command, project, { ...controlled.environment, NODE_ENV: mode }, `${attemptDirectory}/${mode}.log`)
          evidence.outputs = await Promise.all((await listOutputFiles(project, mode)).map(file => outputFileIdentity(project, file, mode)))
          evidence.status = 'built'
          retainGeneratedTemplates(result, await collectGeneratedDocuments(project, output, selected.target, evidence), options.controlledFixtureId)
        }
        catch (error) {
          evidence.status = 'failed'
          evidence.reason = sanitizeLog(error instanceof Error ? error.message : String(error), [project, options.input, process.cwd(), os.homedir()])
        }
        evidence.logs = await Promise.all((await listEvidenceFiles(project)).filter(file => file.startsWith(`${attemptDirectory}/`)).map(file => fileIdentity(project, file)))
      }
      await writeProjectFile(project, report, `${corpusJson(evidence)}\n`)
    }
    result.generations.push({ id, framework: options.framework, version: options.version, target: options.target, mode, status: evidence.status, evidence: [await fileIdentity(project, report)] })
  }
  await writeProjectFile(project, 'documents.jsonl', result.documents.map(corpusJson).join('\n') + (result.documents.length ? '\n' : ''))
  if (options.controlledFixtureId) {
    await writeProjectFile(project, 'matrix-templates.jsonl', result.matrixTemplates.map(corpusJson).join('\n') + (result.matrixTemplates.length ? '\n' : ''))
  }
  await writeProjectFile(project, 'generations.json', `${corpusJson(result.generations)}\n`)
  return result
}
