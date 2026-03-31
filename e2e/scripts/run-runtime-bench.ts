import fs from 'node:fs'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies
import { execa } from 'execa'
import path from 'pathe'
import { assertDevtoolsLoggedIn } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'

const WORKER_PATH = path.resolve(import.meta.dirname, './runtime-bench.worker.ts')
const NATIVE_ROOT = path.resolve(import.meta.dirname, '../../apps/runtime-bench-native')
const VUE_ROOT = path.resolve(import.meta.dirname, '../../apps/runtime-bench-vue')
const LOGIN_CHECK_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/base')
const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const LINE_SPLIT_RE = /\r?\n/
const runtimeProvider = resolveRuntimeProviderName()

interface WorkerResult {
  project: string
  firstScreen: {
    wallMsMedian: number
    readyMsMedian: number
    firstCommitMsMedian: number
  }
  detailNavigation: {
    wallMsMedian: number
    readyMsMedian: number
    firstCommitMsMedian: number
  }
  updateSingleCommit: {
    wallMsMedian: number
    metricMsMedian: number
    computeMsMedian: number
    commitMsMedian: number
    setDataCallsMedian: number
  }
  updateMicroCommit: {
    wallMsMedian: number
    metricMsMedian: number
    computeMsMedian: number
    commitMsMedian: number
    setDataCallsMedian: number
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

async function main() {
  process.stdout.write(`[runtime-bench] provider=${runtimeProvider}\n`)
  if (runtimeProvider === 'devtools') {
    process.stdout.write(`[runtime-bench] preflight=devtools-login-check project=${path.basename(LOGIN_CHECK_ROOT)}\n`)
    await ensureLoginCheckProjectReady(LOGIN_CHECK_ROOT)
    await assertDevtoolsLoggedIn(LOGIN_CHECK_ROOT)
  }
  const native = await runWorker(NATIVE_ROOT)
  const vue = await runWorker(VUE_ROOT)

  const comparison = {
    firstScreen: {
      native,
      vue,
      deltaWallMs: vue.firstScreen.wallMsMedian - native.firstScreen.wallMsMedian,
      deltaReadyMs: vue.firstScreen.readyMsMedian - native.firstScreen.readyMsMedian,
      deltaFirstCommitMs: vue.firstScreen.firstCommitMsMedian - native.firstScreen.firstCommitMsMedian,
    },
    detailNavigation: {
      native,
      vue,
      deltaWallMs: vue.detailNavigation.wallMsMedian - native.detailNavigation.wallMsMedian,
      deltaReadyMs: vue.detailNavigation.readyMsMedian - native.detailNavigation.readyMsMedian,
      deltaFirstCommitMs: vue.detailNavigation.firstCommitMsMedian - native.detailNavigation.firstCommitMsMedian,
    },
    updateSingleCommit: {
      native,
      vue,
      deltaWallMs: vue.updateSingleCommit.wallMsMedian - native.updateSingleCommit.wallMsMedian,
      deltaMetricMs: vue.updateSingleCommit.metricMsMedian - native.updateSingleCommit.metricMsMedian,
      deltaComputeMs: vue.updateSingleCommit.computeMsMedian - native.updateSingleCommit.computeMsMedian,
      deltaCommitMs: vue.updateSingleCommit.commitMsMedian - native.updateSingleCommit.commitMsMedian,
      deltaSetDataCalls: vue.updateSingleCommit.setDataCallsMedian - native.updateSingleCommit.setDataCallsMedian,
    },
    updateMicroCommit: {
      native,
      vue,
      deltaWallMs: vue.updateMicroCommit.wallMsMedian - native.updateMicroCommit.wallMsMedian,
      deltaMetricMs: vue.updateMicroCommit.metricMsMedian - native.updateMicroCommit.metricMsMedian,
      deltaComputeMs: vue.updateMicroCommit.computeMsMedian - native.updateMicroCommit.computeMsMedian,
      deltaCommitMs: vue.updateMicroCommit.commitMsMedian - native.updateMicroCommit.commitMsMedian,
      deltaSetDataCalls: vue.updateMicroCommit.setDataCallsMedian - native.updateMicroCommit.setDataCallsMedian,
    },
  }

  process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n`)
}

void main()
