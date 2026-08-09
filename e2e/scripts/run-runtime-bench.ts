import type { BenchUpdateSummary, WorkerResult } from './runtimeBench'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies
import { execa } from 'execa'
import path from 'pathe'
import { assertDevtoolsLoggedIn } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import {

  readRuntimeBenchCheckpoint,
  resolveRuntimeBenchCheckpointPath,

  writeRuntimeBenchCheckpoint,
} from './runtimeBench'

const WORKER_PATH = path.resolve(import.meta.dirname, './runtime-bench.worker.ts')
const NATIVE_ROOT = path.resolve(import.meta.dirname, '../../apps/runtime-bench-native')
const VUE_ROOT = path.resolve(import.meta.dirname, '../../apps/runtime-bench-vue')
const REACT_ROOT = path.resolve(import.meta.dirname, '../../apps/runtime-bench-react')
const LOGIN_CHECK_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/base')
const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const CHECKPOINT_ROOT = path.resolve(import.meta.dirname, '../../.tmp/runtime-bench/checkpoints')
const LINE_SPLIT_RE = /\r?\n/
const runtimeProvider = resolveRuntimeProviderName()
const RESUME = process.argv.includes('--resume')

interface BenchProject {
  key: 'native' | 'react' | 'vue'
  root: string
}

const BENCH_PROJECTS: BenchProject[] = [
  { key: 'native', root: NATIVE_ROOT },
  { key: 'vue', root: VUE_ROOT },
  { key: 'react', root: REACT_ROOT },
]

function compareUpdateSummary(native: BenchUpdateSummary, candidate: BenchUpdateSummary, label: 'react' | 'vue') {
  return {
    native,
    [label]: candidate,
    deltaWallMs: candidate.wallMsMedian - native.wallMsMedian,
    deltaMetricMs: candidate.metricMsMedian - native.metricMsMedian,
    deltaComputeMs: candidate.computeMsMedian - native.computeMsMedian,
    deltaCommitMs: candidate.commitMsMedian - native.commitMsMedian,
    deltaDispatchMs: candidate.dispatchMsMedian - native.dispatchMsMedian,
    deltaFlushMs: candidate.flushMsMedian - native.flushMsMedian,
    deltaSetDataCalls: candidate.setDataCallsMedian - native.setDataCallsMedian,
    [`${label}SetDataDiagnostics`]: candidate.setDataDiagnosticsMedian,
    [`${label}FallbackReasons`]: candidate.fallbackReasons,
  }
}

function compareVuePatchVsDiff(diff: BenchUpdateSummary, patch: BenchUpdateSummary) {
  return {
    diff,
    patch,
    deltaWallMs: patch.wallMsMedian - diff.wallMsMedian,
    deltaMetricMs: patch.metricMsMedian - diff.metricMsMedian,
    deltaComputeMs: patch.computeMsMedian - diff.computeMsMedian,
    deltaCommitMs: patch.commitMsMedian - diff.commitMsMedian,
    deltaDispatchMs: patch.dispatchMsMedian - diff.dispatchMsMedian,
    deltaFlushMs: patch.flushMsMedian - diff.flushMsMedian,
    deltaSetDataCalls: patch.setDataCallsMedian - diff.setDataCallsMedian,
  }
}

async function ensureLoginCheckProjectReady(projectRoot: string) {
  const appConfigPath = path.resolve(projectRoot, 'dist/app.json')
  if (fs.existsSync(appConfigPath)) {
    return
  }

  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot,
    platform: 'weapp',
    skipNpm: true,
    label: 'runtime-bench:login-preflight',
  })
}

async function runWorker(projectRoot: string): Promise<WorkerResult> {
  const { stdout } = await execa('node', ['--import', 'tsx', WORKER_PATH, projectRoot], {
    cwd: path.resolve(import.meta.dirname, '../..'),
    env: {
      WEAPP_VITE_E2E_RUNTIME_PROVIDER: runtimeProvider,
      WEAPP_VITE_E2E_SKIP_DEVTOOLS_LOGIN_CHECK: '1',
      WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP: '1',
    },
  })

  const line = stdout.split(LINE_SPLIT_RE).find(item => item.startsWith('RUNTIME_BENCH_RESULT '))
  if (!line) {
    throw new Error(`Missing benchmark result for ${projectRoot}`)
  }
  return JSON.parse(line.slice('RUNTIME_BENCH_RESULT '.length)) as WorkerResult
}

async function resolveGitCommit() {
  const { stdout } = await execa('git', ['rev-parse', 'HEAD'], {
    cwd: path.resolve(import.meta.dirname, '../..'),
  })
  return stdout.trim()
}

function checkpointPath(commit: string, project: BenchProject) {
  return resolveRuntimeBenchCheckpointPath({
    checkpointRoot: CHECKPOINT_ROOT,
    commit,
    project: project.key,
    provider: runtimeProvider,
  })
}

async function runProjects(commit: string) {
  const results: Partial<Record<BenchProject['key'], WorkerResult>> = {}
  const failures: Partial<Record<BenchProject['key'], string>> = {}

  for (const project of BENCH_PROJECTS) {
    const filePath = checkpointPath(commit, project)
    if (RESUME) {
      const checkpoint = await readRuntimeBenchCheckpoint(filePath)
      if (checkpoint) {
        process.stdout.write(`[runtime-bench] resume project=${project.key} checkpoint=${path.relative(path.resolve(import.meta.dirname, '../..'), filePath)}\n`)
        results[project.key] = checkpoint
        continue
      }
    }

    try {
      const result = await runWorker(project.root)
      results[project.key] = result
      await writeRuntimeBenchCheckpoint(filePath, result)
      process.stdout.write(`[runtime-bench] checkpoint project=${project.key} status=passed\n`)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures[project.key] = message
      process.stderr.write(`[runtime-bench] project=${project.key} status=failed reason=${message.replace(/\s+/g, ' ').trim().slice(0, 320)}\n`)
    }
  }

  return { failures, results }
}

async function main() {
  process.stdout.write(`[runtime-bench] provider=${runtimeProvider}\n`)
  const commit = await resolveGitCommit()
  if (!RESUME) {
    await fsPromises.rm(path.join(CHECKPOINT_ROOT, commit, runtimeProvider), { recursive: true, force: true })
  }
  if (runtimeProvider === 'devtools') {
    process.stdout.write(`[runtime-bench] preflight=devtools-login-check project=${path.basename(LOGIN_CHECK_ROOT)}\n`)
    await ensureLoginCheckProjectReady(LOGIN_CHECK_ROOT)
    await assertDevtoolsLoggedIn(LOGIN_CHECK_ROOT)
  }
  const { failures, results } = await runProjects(commit)
  const native = results.native
  const vue = results.vue
  const react = results.react
  if (!native || !vue || !react) {
    process.stdout.write(`${JSON.stringify({
      complete: false,
      commit,
      failures,
      provider: runtimeProvider,
      results,
    }, null, 2)}\n`)
    process.exitCode = 1
    return
  }

  const comparison = {
    firstScreen: {
      native,
      vue,
      react,
      deltaWallMs: vue.firstScreen.wallMsMedian - native.firstScreen.wallMsMedian,
      deltaReadyMs: vue.firstScreen.readyMsMedian - native.firstScreen.readyMsMedian,
      deltaFirstCommitMs: vue.firstScreen.firstCommitMsMedian - native.firstScreen.firstCommitMsMedian,
      vueDelta: {
        wallMs: vue.firstScreen.wallMsMedian - native.firstScreen.wallMsMedian,
        readyMs: vue.firstScreen.readyMsMedian - native.firstScreen.readyMsMedian,
        firstCommitMs: vue.firstScreen.firstCommitMsMedian - native.firstScreen.firstCommitMsMedian,
      },
      reactDelta: {
        wallMs: react.firstScreen.wallMsMedian - native.firstScreen.wallMsMedian,
        readyMs: react.firstScreen.readyMsMedian - native.firstScreen.readyMsMedian,
        firstCommitMs: react.firstScreen.firstCommitMsMedian - native.firstScreen.firstCommitMsMedian,
      },
    },
    detailNavigation: {
      native,
      vue,
      react,
      deltaWallMs: vue.detailNavigation.wallMsMedian - native.detailNavigation.wallMsMedian,
      deltaReadyMs: vue.detailNavigation.readyMsMedian - native.detailNavigation.readyMsMedian,
      deltaFirstCommitMs: vue.detailNavigation.firstCommitMsMedian - native.detailNavigation.firstCommitMsMedian,
      vueDelta: {
        wallMs: vue.detailNavigation.wallMsMedian - native.detailNavigation.wallMsMedian,
        readyMs: vue.detailNavigation.readyMsMedian - native.detailNavigation.readyMsMedian,
        firstCommitMs: vue.detailNavigation.firstCommitMsMedian - native.detailNavigation.firstCommitMsMedian,
      },
      reactDelta: {
        wallMs: react.detailNavigation.wallMsMedian - native.detailNavigation.wallMsMedian,
        readyMs: react.detailNavigation.readyMsMedian - native.detailNavigation.readyMsMedian,
        firstCommitMs: react.detailNavigation.firstCommitMsMedian - native.detailNavigation.firstCommitMsMedian,
      },
    },
    updateSingleCommit: {
      diff: compareUpdateSummary(native.updateSingleCommit.diff, vue.updateSingleCommit.diff, 'vue'),
      patch: vue.updateSingleCommit.patch
        ? compareUpdateSummary(native.updateSingleCommit.diff, vue.updateSingleCommit.patch, 'vue')
        : undefined,
      patchVsDiff: vue.updateSingleCommit.patch
        ? compareVuePatchVsDiff(vue.updateSingleCommit.diff, vue.updateSingleCommit.patch)
        : undefined,
      reactDynamic: compareUpdateSummary(native.updateSingleCommit.diff, react.updateSingleCommit.diff, 'react'),
    },
    updateMicroCommit: {
      diff: compareUpdateSummary(native.updateMicroCommit.diff, vue.updateMicroCommit.diff, 'vue'),
      patch: vue.updateMicroCommit.patch
        ? compareUpdateSummary(native.updateMicroCommit.diff, vue.updateMicroCommit.patch, 'vue')
        : undefined,
      patchVsDiff: vue.updateMicroCommit.patch
        ? compareVuePatchVsDiff(vue.updateMicroCommit.diff, vue.updateMicroCommit.patch)
        : undefined,
      reactDynamic: compareUpdateSummary(native.updateMicroCommit.diff, react.updateMicroCommit.diff, 'react'),
    },
    reactStaticBinding: react.staticBinding,
  }

  process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n`)
}

void main()
