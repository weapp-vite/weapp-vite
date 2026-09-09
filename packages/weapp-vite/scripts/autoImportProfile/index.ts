import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { delimiter } from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import path from 'pathe'
import { sampleHeapAfterGc, waitForInspectorUrl } from '../../../../e2e/utils/dev-memory'
import { startDevProcess } from '../../../../e2e/utils/dev-process'
import { createDevProcessEnv } from '../../../../e2e/utils/dev-process-env'
import { HMR_OUTPUT_POLL_INTERVAL_MS, measureFileMarkerUpdate } from '../utils/hmrOutput'
import { allResolverTags, cliPath, createTempFixtureProject, seedFixture, workspaceRootDir, workspaceRootNodeModulesDir } from './fixture'

const reportRoot = path.resolve(process.env.AUTO_IMPORT_PROFILE_REPORT_DIR ?? '.tmp/auto-import-profile')
const iterations = Number(process.env.BENCH_ITERATIONS ?? '2')
const scenarios = (process.env.BENCH_SCENARIOS ?? '1,100').split(',').map(Number)
const timeoutMs = 90_000
const firstBuildReady = /小程序初次构建完成[\s\S]*开发服务已就绪/
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

interface UpdateSample {
  index: number
  marker: string
  startedAt: string
  updateMs?: number
  status: 'running' | 'passed' | 'failed'
}

function insertMarker(source: string, marker: string) {
  const needle = '  </view>\n</template>'
  if (!source.includes(needle)) {
    throw new Error('Unexpected benchmark fixture template.')
  }
  return source.replace(needle, `    <view data-bench-marker="${marker}">${marker}</view>\n${needle}`)
}

async function measure(group: string, mode: 'baseline' | 'current', usedCount: number, iteration: number) {
  const label = `${group}/${mode}-${usedCount}-${iteration}`
  const artifactDir = path.join(reportRoot, label)
  await mkdir(artifactDir, { recursive: true })
  const project = await createTempFixtureProject(`auto-import-profile-${mode}-${usedCount}-${iteration}`)
  const updates: UpdateSample[] = []
  const run: Record<string, unknown> = { label, sha, group, mode, usedCount, iteration, status: 'running' }
  const record = async () => await writeFile(path.join(artifactDir, 'run.json'), JSON.stringify({ ...run, updates }, null, 2))
  await record()
  try {
    let source = await seedFixture(project.tempDir, allResolverTags.slice(0, usedCount), group === 'support-disabled', mode)
    await rm(path.join(project.tempDir, 'dist'), { recursive: true, force: true })
    await rm(path.join(project.tempDir, '.weapp-vite'), { recursive: true, force: true })
    const pagePath = path.join(project.tempDir, 'src/pages/bench-hmr-auto-import/index.vue')
    const outputPath = path.join(project.tempDir, 'dist/pages/bench-hmr-auto-import/index.wxml')
    const startupStart = performance.now()
    const dev = startDevProcess(process.execPath, [cliPath, 'dev', project.tempDir, '--platform', 'weapp', '--skipNpm'], {
      cwd: workspaceRootDir,
      env: {
        ...createDevProcessEnv({ nodeOptions: '--expose-gc --inspect=127.0.0.1:0' }),
        DEBUG: 'weapp-vite:load-entry',
        PATH: `${path.join(workspaceRootNodeModulesDir, '.bin')}${delimiter}${process.env.PATH ?? ''}`,
        WEAPP_VITE_HMR_PROFILE_JSON: path.join(artifactDir, 'hmr-profile.jsonl'),
        WEAPP_VITE_STATEFUL_HMR_SNAPSHOT_TRACE: '1',
      },
      stdout: 'pipe',
      stderr: 'pipe',
      all: true,
    })
    try {
      await dev.waitForOutput(firstBuildReady, `${label} initial output`, timeoutMs)
      run.startupMs = performance.now() - startupStart
      const inspector = await waitForInspectorUrl(dev.getOutput, label, timeoutMs)
      // 首次更新保持正式 benchmark 的 ready -> GC -> 写文件边界，不增加稳定等待。
      run.startupMemory = await sampleHeapAfterGc(inspector).catch(() => undefined)
      for (let index = 0; index < 4; index++) {
        const marker = `auto-import-hmr-${mode}-${usedCount}-${iteration}-${index}`
        source = insertMarker(source, marker)
        const sample: UpdateSample = { index, marker, startedAt: new Date().toISOString(), status: 'running' }
        updates.push(sample)
        const controller = new AbortController()
        try {
          sample.updateMs = await dev.waitFor(measureFileMarkerUpdate({
            outputPath,
            marker,
            update: async () => await writeFile(pagePath, source, 'utf8'),
            timeoutMs,
            signal: controller.signal,
          }), `${label} emitted marker ${index}`)
          sample.status = 'passed'
        }
        catch (error) {
          sample.status = 'failed'
          throw error
        }
        finally {
          controller.abort()
        }
      }
      run.updateMemory = await sampleHeapAfterGc(inspector).catch(() => undefined)
      run.status = 'passed'
    }
    finally {
      // dev 输出包含真实 snapshot 阶段和文件散列；失败同样保存并完整关闭进程。
      try {
        await writeFile(path.join(artifactDir, 'dev.log'), dev.getOutput())
      }
      finally {
        await dev.stop()
      }
    }
  }
  catch (error) {
    run.status = 'failed'
    run.error = error instanceof Error ? error.message : String(error)
    throw error
  }
  finally {
    try {
      await record()
    }
    finally {
      await project.cleanup()
    }
  }
  console.log(`[auto-import-profile] ${label}: ${updates.map(sample => sample.updateMs?.toFixed(2)).join(', ')} ms`)
  return run
}

async function main() {
  if (!Number.isInteger(iterations) || iterations < 1 || scenarios.some(count => !Number.isInteger(count) || count < 1 || count > allResolverTags.length)) {
    throw new Error('Invalid profiling iterations or component counts.')
  }
  if (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== sha) {
    throw new Error('Profiling checkout does not match workflow SHA.')
  }
  await mkdir(path.dirname(reportRoot), { recursive: true })
  // 已有采样目录直接报错，避免 JSONL 追加旧提交的证据。
  await mkdir(reportRoot)
  const metadata = {
    diagnosticOnly: true,
    note: '同一 SHA 的手写注册与自动导入对照。禁用支持文件仅用于隔离成本；任何结果均不替代正式性能验收。',
    sha,
    sourceBaseSha: execFileSync('git', ['rev-parse', 'HEAD^'], { encoding: 'utf8' }).trim(),
    cliSha256: createHash('sha256').update(await readFile(path.resolve(import.meta.dirname, '../../dist/cli.mjs'))).digest('hex'),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu: os.cpus()[0]?.model,
    logicalCpuCount: os.availableParallelism(),
    runnerImage: process.env.ImageVersion,
    iterations,
    scenarios,
    snapshotTrace: true,
    hmrProfile: true,
    updatesPerProcess: 4,
    updateMeasurement: { completion: 'emitted-template-marker', clock: 'performance.now', pollIntervalMs: HMR_OUTPUT_POLL_INTERVAL_MS },
    extraWaitBeforeFirstUpdate: false,
    automaticRetries: false,
  }
  await writeFile(path.join(reportRoot, 'metadata.json'), JSON.stringify(metadata, null, 2))
  const runs: Record<string, unknown>[] = []
  let failed = false
  for (const group of ['normal', 'support-disabled']) {
    for (const usedCount of scenarios) {
      for (let iteration = 0; iteration < iterations; iteration++) {
        for (const mode of ['baseline', 'current'] as const) {
          try {
            runs.push(await measure(group, mode, usedCount, iteration))
          }
          catch (error) {
            failed = true
            runs.push({ group, mode, usedCount, iteration, status: 'failed', error: error instanceof Error ? error.message : String(error) })
          }
        }
      }
    }
  }
  await writeFile(path.join(reportRoot, 'index.json'), JSON.stringify({ ...metadata, runs, status: failed ? 'diagnostic-failed' : 'diagnostic-complete' }, null, 2))
  process.exitCode = failed ? 1 : 0
}

void main().catch(() => {
  console.error('Auto Import diagnostic orchestration failed; inspect raw evidence locally.')
  process.exitCode = 1
})
