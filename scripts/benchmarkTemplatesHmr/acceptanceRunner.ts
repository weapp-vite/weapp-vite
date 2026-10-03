/* eslint-disable e18e/ban-dependencies -- 验收驱动使用跨平台子进程和既有进程所有权清理。 */
import type { AcceptanceOptions, AcceptanceRun, HmrInput, HmrSide } from './acceptanceContract'
import { createHash } from 'node:crypto'
import { access, cp, mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { redactSequenceEvidenceText } from '../editSequence/evidenceRedaction'
import { runCollector } from '../performanceGate/process'
import { baselineProfileAvailable, HMR_ACCEPTANCE_BASELINE, readAcceptanceSamples } from './acceptanceContract'

const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')
const ignored = new Set(['node_modules', 'dist', 'dist-lib', 'dist-plugin', '.git', '.weapp-vite', '.turbo', '.tmp'])
const posix = (value: string) => value.replaceAll('\\', '/')

export function sanitizeAcceptanceText(value: string, roots: string[]) {
  const redactText = (text: string) => {
    let result = text
    for (const root of [...roots, os.homedir(), os.tmpdir()].sort((a, b) => b.length - a.length)) {
      for (const variant of new Set([root, posix(root), root.replaceAll('\\', '\\\\')])) {
        result = result.replaceAll(variant, '<workspace>')
      }
    }
    return redactSequenceEvidenceText(result, roots[0] ?? os.homedir()).replaceAll('<fixture>', '<workspace>').replaceAll('<repo>', '<workspace>')
  }
  const redactValue = (item: unknown): unknown => {
    if (typeof item === 'string') {
      return redactText(item)
    }
    if (Array.isArray(item)) {
      return item.map(redactValue)
    }
    if (item && typeof item === 'object') {
      return Object.fromEntries(Object.entries(item).map(([key, entry]) => [redactText(key), redactValue(entry)]))
    }
    return item
  }
  // 完整 JSON 先解析再脱敏，避免解码 URL 或反斜杠时破坏引号、换行与数值。
  try {
    return `${JSON.stringify(redactValue(JSON.parse(value)), null, value.trim().includes('\n') ? 2 : undefined)}${value.endsWith('\n') ? '\n' : ''}`
  }
  catch {
    return value.split(/\r?\n/).map((line) => {
      try {
        return JSON.stringify(redactValue(JSON.parse(line)))
      }
      catch {
        return redactText(line)
      }
    }).join('\n')
  }
}

/** 验收仅消费干净固定提交；不替换工作树，不修改历史源码。 */
export async function verifyAcceptanceCheckout(root: string, expectedSha: string) {
  const sha = (await execa('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim()
  const dirty = (await execa('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root })).stdout.trim()
  if (sha !== expectedSha || dirty) {
    throw new Error('Acceptance requires the exact clean checkout SHA')
  }
  const resolvedRoot = await realpath(root)
  const modules = path.relative(resolvedRoot, await realpath(path.join(root, 'node_modules')))
  if (path.isAbsolute(modules) || modules === '..' || modules.startsWith(`..${path.sep}`)) {
    throw new Error('Acceptance requires dependencies installed inside their own checkout')
  }
  return { sha, lockfileSha256: hash(await readFile(path.join(root, 'pnpm-lock.yaml'))) }
}

export async function rebuildAcceptanceCheckouts(options: AcceptanceOptions) {
  const metadata: Record<string, unknown> = {}
  for (const side of ['baseline', 'candidate'] as const) {
    const root = options[side]
    metadata[side] = await verifyAcceptanceCheckout(root, side === 'baseline' ? HMR_ACCEPTANCE_BASELINE : options.candidateSha)
    await runCollector('pnpm', ['--filter', 'weapp-vite...', '--filter', 'wevu...', '-r', 'run', 'build'], {
      cwd: root,
      timeoutMs: 20 * 60_000,
      logFile: path.join(options.output, 'preparation', `${side}.log`),
      redact: [options.baseline, options.candidate, options.output, os.homedir(), os.tmpdir()],
    })
    await verifyAcceptanceCheckout(root, side === 'baseline' ? HMR_ACCEPTANCE_BASELINE : options.candidateSha)
  }
  return metadata
}

export async function acceptanceInputManifest(root: string) {
  const manifest: Record<string, string> = {}
  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (ignored.has(entry.name)) {
        continue
      }
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(file)
      }
      else if (entry.isFile()) {
        manifest[posix(path.relative(root, file))] = hash(await readFile(file))
      }
      else {
        throw new Error('Benchmark inputs must contain ordinary files, not symbolic links')
      }
    }
  }
  await visit(root)
  return Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)))
}

export async function prepareAcceptanceInput(options: AcceptanceOptions, side: HmrSide, input: HmrInput) {
  const tempRoot = path.join(options[side], '.tmp')
  await mkdir(tempRoot, { recursive: true })
  const ownedRoot = await mkdtemp(path.join(tempRoot, 'hmr-attribution-'))
  const project = path.join(ownedRoot, 'input', input.id)
  try {
    const source = path.join(options.candidate, input.source)
    await cp(source, project, { recursive: true, filter: file => !posix(path.relative(source, file)).split('/').some(part => ignored.has(part)) })
    const dependencyRoot = await realpath(path.join(options[side], input.dependencies, 'node_modules'))
    await symlink(dependencyRoot, path.join(project, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
    const require = createRequire(path.join(project, 'package.json'))
    const packageFile = await realpath(path.join(project, 'node_modules/weapp-vite/package.json'))
    const nodeResolution = await realpath(require.resolve('weapp-vite/package.json'))
    const expectedPackage = await realpath(path.join(options[side], 'packages/weapp-vite/package.json'))
    if (packageFile !== expectedPackage || nodeResolution !== expectedPackage) {
      throw new Error('Fixture resolves weapp-vite outside its owning checkout')
    }
    if (input.id === 'weapp-vite-wevu-template') {
      const runtimePackage = await realpath(path.join(project, 'node_modules/wevu/package.json'))
      if (runtimePackage !== await realpath(path.join(options[side], 'packages-runtime/wevu/package.json'))) {
        throw new Error('SFC fixture resolves wevu outside its owning checkout')
      }
    }
    return { ownedRoot, project, manifest: await acceptanceInputManifest(project), packageManifestSha256: hash(await readFile(packageFile)) }
  }
  catch (error) {
    await rm(ownedRoot, { recursive: true, force: true })
    throw error
  }
}

export function acceptanceCollectorEnv(options: AcceptanceOptions, side: HmrSide, input: HmrInput, directory: string, project: string, workspace: string, markerSeed: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = Object.fromEntries(Object.entries(process.env).map(([key, value]) => [key, key.startsWith('TEMPLATES_HMR_') || key.startsWith('WEAPP_VITE_') || key === 'NODE_OPTIONS' ? undefined : value]))
  return {
    ...env,
    TEMPLATES_HMR_REPO_ROOT: options[side],
    TEMPLATES_HMR_CLI_PATH: path.join(options[side], 'packages/weapp-vite/bin/weapp-vite.js'),
    TEMPLATES_HMR_PROJECT_ROOT: project,
    TEMPLATES_HMR_REPORT_DIR: directory,
    TEMPLATES_HMR_WORKSPACE_ROOT: workspace,
    TEMPLATES_HMR_ITERATIONS: '2',
    TEMPLATES_HMR_RUNTIME: options.runtime,
    TEMPLATES_HMR_SCENARIO_FILTER: input.scenarios.join(','),
    TEMPLATES_HMR_SAMPLE_MODE: 'edit-only',
    TEMPLATES_HMR_MARKER_SEED: markerSeed,
    TEMPLATES_HMR_PROFILE: baselineProfileAvailable(side, options.runtime) ? '1' : '0',
    TEMPLATES_HMR_PROFILE_TIMEOUT_MS: '15000',
    TEMPLATES_HMR_OUTPUT_SCOPE: '1',
    TEMPLATES_HMR_KEEP_WORKSPACE: '1',
    TEMPLATES_HMR_FAIL_ON_ERROR: '0',
    TEMPLATES_HMR_STOP_ON_ERROR: '1',
  }
}

async function sanitizeDirectory(directory: string, roots: string[]) {
  for (const entry of await readdir(directory, { recursive: true, withFileTypes: true })) {
    if (entry.isFile() && /\.(?:jsonl?|md|log)$/.test(entry.name)) {
      const file = path.join(entry.parentPath, entry.name)
      await writeFile(file, sanitizeAcceptanceText(await readFile(file, 'utf8'), roots))
    }
  }
}

/** 每侧使用新会话；无论成功与否，先归档原始诊断，再释放本次隔离文件。 */
export async function collectAcceptanceRun(options: AcceptanceOptions, side: HmrSide, input: HmrInput, round: number, batch: string, deadline: number): Promise<AcceptanceRun> {
  const directory = path.join(options.output, batch, input.id, String(round), side)
  const markerSeed = `hmr-attribution-${batch}-${round}`
  const result: AcceptanceRun = { round, side, input: input.id, markerSeed, samples: [] }
  await mkdir(directory, { recursive: true })
  const staged = await prepareAcceptanceInput(options, side, input)
  result.inputDigest = hash(JSON.stringify(staged.manifest))
  const workspace = path.join(staged.ownedRoot, 'workspace')
  const roots = [options.baseline, options.candidate, options.output]
  try {
    await writeFile(path.join(directory, 'input-manifest.json'), `${JSON.stringify(staged.manifest, null, 2)}\n`)
    await runCollector(process.execPath, ['--import', 'tsx', 'scripts/benchmark-templates-hmr.ts'], {
      cwd: options.candidate,
      logFile: path.join(directory, 'collector.log'),
      timeoutMs: Math.min(15 * 60_000, deadline - Date.now()),
      env: acceptanceCollectorEnv(options, side, input, directory, staged.project, workspace, markerSeed),
      redact: [...roots, os.homedir(), os.tmpdir()],
    })
    const rawProfile = await readFile(path.join(workspace, input.id, '.weapp-vite/hmr-profile.jsonl'), 'utf8').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT' && !baselineProfileAvailable(side, options.runtime)) {
        return ''
      }
      throw error
    })
    await writeFile(path.join(directory, 'profile.raw.jsonl'), rawProfile)
    const report = JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8')) as unknown
    result.samples = readAcceptanceSamples(report, rawProfile, input, side, options.runtime, markerSeed)
    await access(path.join(workspace, input.id, 'dist/app.json'))
    await writeFile(path.join(directory, 'profile-capability.json'), `${JSON.stringify({ producer: side === 'baseline' ? HMR_ACCEPTANCE_BASELINE : options.candidateSha, profile: baselineProfileAvailable(side, options.runtime) ? 'enabled' : 'unavailable', historicalStages: baselineProfileAvailable(side, options.runtime) ? 'observed-only' : 'unknown', reason: baselineProfileAvailable(side, options.runtime) ? undefined : 'Fixed baseline has no stateful profile producer; existing collector profiling is disabled without changing baseline source.', packageManifestSha256: staged.packageManifestSha256 })}\n`)
  }
  catch (error) {
    result.error = sanitizeAcceptanceText(String(error), roots)
    const rawFile = path.join(workspace, input.id, '.weapp-vite/hmr-profile.jsonl')
    const partial = await readFile(rawFile, 'utf8').catch(() => undefined)
    if (partial !== undefined) {
      await writeFile(path.join(directory, 'profile.raw.jsonl'), partial)
    }
  }
  finally {
    await sanitizeDirectory(directory, roots)
    await rm(staged.ownedRoot, { recursive: true, force: true })
  }
  return result
}
