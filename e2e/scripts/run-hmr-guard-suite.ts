import type { HmrGuardSuiteName } from './hmr-guard-manifest'
import path from 'node:path'
import process from 'node:process'
import { withMachineE2ELease } from '../../packages/devtools-runtime/src/lease/machine'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { E2E_TARGET_FILE_ENV } from '../utils/vitestTargetFile'
import {
  getHmrGuardTestPaths,
  HMR_GUARD_ALL_TESTS,
  HMR_GUARD_SUITES,
  HMR_GUARD_UTILITIES_ALREADY_RUN_OPTION,
  HMR_GUARD_UTILITY_TESTS,
} from './hmr-guard-manifest'
import {
  FORCE_HMR_GUARD_ENV,
  shouldForceDiskBackedMiniProgramDevChecks,
  supportsDiskBackedMiniProgramDev,
} from './mini-program-dev-support'
import { runTaskSuite } from './suiteRunner'

const VITEST_CONFIG_PATH = path.resolve(import.meta.dirname, '../vitest.e2e.ci.config.ts')
const E2E_ROOT = path.resolve(import.meta.dirname, '..')

function formatLabel(testPath: string) {
  return path.relative(E2E_ROOT, testPath).replaceAll('\\', '/')
}

async function runSuite(name: HmrGuardSuiteName, utilitiesAlreadyRun: boolean) {
  const testPaths = getHmrGuardTestPaths(name, { utilitiesAlreadyRun })
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

  await runTaskSuite(`hmr-guard:${name}`, testPaths.map(testPath => ({
    label: formatLabel(testPath),
    command: 'pnpm',
    args: ['vitest', 'run', '--config', VITEST_CONFIG_PATH],
    env: {
      [E2E_TARGET_FILE_ENV]: formatLabel(testPath),
    },
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
  console.log('- utility guards:')
  for (const testPath of HMR_GUARD_UTILITY_TESTS) {
    console.log(`  - ${formatLabel(testPath)}`)
  }
  for (const [name, suite] of Object.entries(HMR_GUARD_SUITES)) {
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

const [command = 'full', ...options] = process.argv.slice(2)

if (options.some(option => option !== HMR_GUARD_UTILITIES_ALREADY_RUN_OPTION)) {
  console.error(`Unknown HMR guard option: ${options.find(option => option !== HMR_GUARD_UTILITIES_ALREADY_RUN_OPTION)}`)
  process.exitCode = 1
}
else if (command === 'list') {
  printList()
}
else if (command in HMR_GUARD_SUITES) {
  await withMachineE2ELease(() => runSuite(command as HmrGuardSuiteName, options.includes(HMR_GUARD_UTILITIES_ALREADY_RUN_OPTION)))
}
else {
  console.error(`Unknown HMR guard suite: ${command}`)
  process.exitCode = 1
}
