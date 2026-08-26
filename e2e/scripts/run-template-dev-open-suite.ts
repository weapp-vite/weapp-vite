import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- e2e runner 需要跨平台启动 Vitest 子任务
import { execa } from 'execa'
import { createTemplateDevOpenArgs, resolveTemplateDevOpenProjectRoot, TEMPLATE_DEV_OPEN_CASES } from '../ide/template-dev-open-cases'
import { assertDevtoolsLoggedIn } from '../utils/automator'
import { cleanupTrackedDevProcesses, startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { waitForOpenedAutomator } from '../utils/opened-automator'
import { E2E_TARGET_FILE_ENV } from '../utils/vitestTargetFile'

const ROOT = path.resolve(import.meta.dirname, '../..')
const CONFIG_PATH = path.resolve(ROOT, 'e2e/vitest.e2e.devtools.config.ts')
const LOGIN_CHECK_ROOT = path.resolve(ROOT, 'e2e-apps/base')
const DEFAULT_TARGET_FILE = 'ide/template-dev-open-all.runtime.test.ts'
const MULTI_TEMPLATE_TARGET_FILE = 'ide/template-tailwindcss-dev-open-multi.runtime.test.ts'
const TARGET_FILE = process.env[E2E_TARGET_FILE_ENV]?.trim() || DEFAULT_TARGET_FILE
const TEMPLATE_READY_TIMEOUT_MS = 180_000
const MULTI_TEMPLATE_NAMES = new Set([
  'weapp-vite-tailwindcss-template',
  'weapp-vite-tailwindcss-vant-template',
  'weapp-vite-tailwindcss-tdesign-template',
])

function isMultiTemplateTarget() {
  return TARGET_FILE.replaceAll('\\', '/').endsWith(MULTI_TEMPLATE_TARGET_FILE)
}

async function runVitest(env: NodeJS.ProcessEnv) {
  const result = await execa('pnpm', ['vitest', 'run', '-c', CONFIG_PATH], {
    cwd: ROOT,
    env,
    extendEnv: false,
    reject: false,
    stderr: 'inherit',
    stdin: 'ignore',
    stdout: 'inherit',
  })
  return result.exitCode ?? 1
}

async function runTemplateCase(
  templateCase: (typeof TEMPLATE_DEV_OPEN_CASES)[number],
  previousTemplateCase?: (typeof TEMPLATE_DEV_OPEN_CASES)[number],
) {
  await cleanupResidualIdeProcesses()
  const dev = startDevProcess('pnpm', createTemplateDevOpenArgs(templateCase), {
    cwd: templateCase.root,
    env: createDevProcessEnv({ usePolling: false }),
    reject: false,
  })
  try {
    const projectRoot = resolveTemplateDevOpenProjectRoot(templateCase)
    const session = await dev.waitFor(
      waitForOpenedAutomator(projectRoot, {
        readyRoute: templateCase.assertWrapperProject ? undefined : templateCase.route,
        skipAppReady: templateCase.assertWrapperProject,
        timeoutMs: TEMPLATE_READY_TIMEOUT_MS,
      }),
      `${templateCase.name} automator ready`,
    )
    session.miniProgram.disconnect()
    return await runVitest({
      ...process.env,
      WEAPP_VITE_E2E_IDE_HMR_COMPANION: '0',
      WEAPP_VITE_E2E_PRESTARTED_TEMPLATE_DEV: '1',
      WEAPP_VITE_E2E_SKIP_DEVTOOLS_LOGIN_CHECK: '1',
      WEAPP_VITE_E2E_TEMPLATE: templateCase.name,
      WEAPP_VITE_E2E_TARGET_FILE: TARGET_FILE,
      ...(previousTemplateCase
        ? { WEAPP_VITE_E2E_PREVIOUS_TEMPLATE: previousTemplateCase.name }
        : {}),
    })
  }
  finally {
    await dev.stop().catch(() => {})
    await cleanupTrackedDevProcesses()
    await cleanupResidualIdeProcesses()
  }
}

async function main() {
  const templateFilter = process.env.WEAPP_VITE_E2E_TEMPLATE?.trim()
  const targetCases = isMultiTemplateTarget()
    ? TEMPLATE_DEV_OPEN_CASES.filter(templateCase => MULTI_TEMPLATE_NAMES.has(templateCase.name))
    : TEMPLATE_DEV_OPEN_CASES
  const templateCases = templateFilter
    ? targetCases.filter(templateCase => templateCase.name === templateFilter)
    : targetCases
  if (templateCases.length === 0) {
    throw new Error(`Unknown template dev:open case: ${templateFilter}`)
  }

  if (process.env.WEAPP_VITE_E2E_SKIP_DEVTOOLS_LOGIN_CHECK !== '1') {
    await cleanupResidualIdeProcesses()
    await assertDevtoolsLoggedIn(LOGIN_CHECK_ROOT)
    await cleanupResidualIdeProcesses()
  }

  let previousTemplateCase: (typeof TEMPLATE_DEV_OPEN_CASES)[number] | undefined
  for (const templateCase of templateCases) {
    process.stdout.write(`[template-dev-open-suite] start template=${templateCase.name}\n`)
    const exitCode = await runTemplateCase(templateCase, previousTemplateCase)
    if (exitCode !== 0) {
      process.exitCode = exitCode
      return
    }
    process.stdout.write(`[template-dev-open-suite] pass template=${templateCase.name}\n`)
    previousTemplateCase = templateCase
  }
}

await main()
