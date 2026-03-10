import path from 'node:path'
import process from 'node:process'
import {
  clearRuntimeWarningLog,
  ensureIdeWarningReportEnv,
  writeIdeWarningReport,
} from './utils/ideWarningReport'

const DEFAULT_LOGIN_CHECK_PROJECT = path.resolve(import.meta.dirname, '../e2e-apps/base')

function shouldRunDevtoolsLoginPreflight() {
  const argv = process.argv.map(arg => arg.replaceAll('\\', '/'))
  const hasIdeTargets = argv.some(arg => arg.includes('e2e/ide/'))
  if (hasIdeTargets) {
    return true
  }

  const hasOnlyCiTargets = argv.some(arg => arg.includes('e2e/ci/'))
  if (hasOnlyCiTargets) {
    return false
  }

  return true
}

export default async function setupIdeE2E() {
  const reportPaths = ensureIdeWarningReportEnv()

  if (process.env.WEAPP_VITE_E2E_SKIP_DEVTOOLS_LOGIN_CHECK === '1') {
    return async () => {
      writeIdeWarningReport(reportPaths)
    }
  }
  if (!shouldRunDevtoolsLoginPreflight()) {
    return async () => {
      writeIdeWarningReport(reportPaths)
    }
  }

  const { assertDevtoolsLoggedIn } = await import('./utils/automator')
  const projectPath = process.env.WEAPP_VITE_E2E_LOGIN_CHECK_PROJECT_PATH || DEFAULT_LOGIN_CHECK_PROJECT
  await assertDevtoolsLoggedIn(projectPath)
  clearRuntimeWarningLog(reportPaths.eventLogPath)

  return async () => {
    writeIdeWarningReport(reportPaths)
  }
}
