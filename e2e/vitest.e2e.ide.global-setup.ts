import path from 'node:path'
import process from 'node:process'
import { assertDevtoolsLoggedIn } from './utils/automator'

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
  if (process.env.WEAPP_VITE_E2E_SKIP_DEVTOOLS_LOGIN_CHECK === '1') {
    return
  }
  if (!shouldRunDevtoolsLoginPreflight()) {
    return
  }

  const projectPath = process.env.WEAPP_VITE_E2E_LOGIN_CHECK_PROJECT_PATH || DEFAULT_LOGIN_CHECK_PROJECT
  await assertDevtoolsLoggedIn(projectPath)
}
