import path from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'
import { excludedE2ETestPatterns } from '../scripts/e2eProjectScope.ts'
import { resolveVerificationTopology } from '../scripts/verification/topology'
import { localReporters, localTestPolicy } from '../scripts/verificationBenchmark/localReporterConfig.mjs'
import { GITHUB_ISSUES_BUILD_BASELINE_LABEL, GITHUB_ISSUES_BUILD_TASK_LABELS } from './ci/githubIssuesBuild/groups'
import { resolveE2EMaxWorkers } from './utils/max-workers.ts'
import { resolveVitestIncludePatterns } from './utils/vitestTargetFile.ts'

const CI_TEST_GLOB = path.resolve(import.meta.dirname, './ci/**/*.test.ts').replaceAll('\\', '/')
const topology = resolveVerificationTopology()
const excludedGithubIssueBuilds = topology.id === 'optimized-v2'
  ? [GITHUB_ISSUES_BUILD_BASELINE_LABEL]
  : GITHUB_ISSUES_BUILD_TASK_LABELS

export default defineConfig({
  test: {
    reporters: localReporters(),
    ...localTestPolicy(),
    // 构建、headless 和 mock 契约共享机器互斥，不初始化真实 IDE 所有权。
    globalSetup: [path.resolve(import.meta.dirname, 'vitest.e2e.machine-lease.global-setup.ts')],
    exclude: [
      ...configDefaults.exclude,
      ...excludedE2ETestPatterns(),
      ...excludedGithubIssueBuilds.map(label => path.resolve(import.meta.dirname, label).replaceAll('\\', '/')),
    ],
    include: resolveVitestIncludePatterns(import.meta.dirname, [CI_TEST_GLOB]),
    testTimeout: 36_000_000,
    globals: true,
    pool: 'threads',
    maxWorkers: resolveE2EMaxWorkers(),
    fileParallelism: false,
  },
})
