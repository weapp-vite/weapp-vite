import path from 'node:path'
import process from 'node:process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import {
  HMR_GUARD_ALL_TESTS,
  HMR_GUARD_SMOKE_TESTS,
  HMR_GUARD_SPECIAL_CASES,
  HMR_GUARD_STABLE_TESTS,
} from './hmr-guard-manifest'
import {
  FORCE_HMR_GUARD_ENV,
  shouldForceDiskBackedMiniProgramDevChecks,
  supportsDiskBackedMiniProgramDev,
} from './mini-program-dev-support'
import { runTaskSuite } from './suiteRunner'

const VITEST_CONFIG_PATH = path.resolve(import.meta.dirname, '../vitest.e2e.ci.config.ts')

const SUITES = {
  'full': {
    description: '稳定 HMR 护栏全集，不包含入口敏感的 shared-chunks-auto 特例',
    tests: HMR_GUARD_STABLE_TESTS,
  },
  'smoke': {
    description: '本地快速 HMR smoke 子集',
    tests: HMR_GUARD_SMOKE_TESTS,
  },
  'shared-chunks-auto': {
    description: 'sharedChunks=auto 特例，需独立运行避免与其他 dev-watch 用例互相干扰',
    tests: [HMR_GUARD_SPECIAL_CASES.sharedChunksAuto],
  },
  'auto-routes-hmr': {
    description: 'auto-routes HMR 特例，需独立运行避免与其他 dev-watch 用例互相干扰',
    tests: [HMR_GUARD_SPECIAL_CASES.autoRoutesHmr],
  },
} as const

type SuiteName = keyof typeof SUITES

function formatLabel(testPath: string) {
  return path.relative(path.resolve(import.meta.dirname, '..'), testPath).replaceAll('\\', '/')
}

async function runSuite(name: SuiteName) {
  const suite = SUITES[name]
  if (!shouldForceDiskBackedMiniProgramDevChecks()) {
    const hasDiskBackedDevOutput = await supportsDiskBackedMiniProgramDev()
    if (!hasDiskBackedDevOutput) {
      console.warn(
        `[hmr-guard:${name}] skip: 当前 CLI 级 dev watch 已就绪但未落盘 dist 产物；`
        + `现有文件系统型 HMR 护栏在该环境下不稳定。若需强制运行，请设置 ${FORCE_HMR_GUARD_ENV}=1。`,
      )
      return
    }
  }

  await runTaskSuite(`hmr-guard:${name}`, suite.tests.map(testPath => ({
    label: formatLabel(testPath),
    command: 'pnpm',
    args: ['vitest', 'run', testPath, '--config', VITEST_CONFIG_PATH],
  })), {
    beforeEachTask: async () => {
      await cleanupResidualDevProcesses()
    },
    afterAll: async () => {
      await cleanupResidualDevProcesses()
    },
  })
}

function printList() {
  console.log('HMR guard suites:')
  for (const [name, suite] of Object.entries(SUITES)) {
    console.log(`- ${name}: ${suite.description}`)
    for (const testPath of suite.tests) {
      console.log(`  - ${formatLabel(testPath)}`)
    }
  }
  console.log('- config-all: Vitest include list used by e2e/vitest.e2e.hmr-guard.config.ts')
  for (const testPath of HMR_GUARD_ALL_TESTS) {
    console.log(`  - ${formatLabel(testPath)}`)
  }
}

const command = process.argv[2] ?? 'full'

if (command === 'list') {
  printList()
}
else if (command in SUITES) {
  await runSuite(command as SuiteName)
}
else {
  console.error(`Unknown HMR guard suite: ${command}`)
  process.exitCode = 1
}
