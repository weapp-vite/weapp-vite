import type { DevtoolsMatrixEntry, DevtoolsMatrixRun } from './devtoolsMatrix'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { readOfficialWechatDevtoolsVersion, resolveWechatDevtoolsTarget, splitWechatDevtoolsSelectionArgs } from 'weapp-ide-cli'
import { withMachineE2ELease } from '../../packages/devtools-runtime/src/lease/machine'
import { inspectExitedWechatInstallation } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/processes'
import { DEVTOOLS_SELECTION_ENV_KEYS } from '../utils/devtoolsCli'
import { parseDevtoolsMatrixTargets, runDevtoolsMatrix } from './devtoolsMatrix'
import { sanitizeAcceptanceValue } from './domAcceptanceReport/helpers'
import { getSuiteTasks } from './e2e-suite-manifest'
import { runE2ESuiteCli } from './run-e2e-suite'
import { createSuiteSignalScope } from './suiteRunner/signals'

function parseArgs(args: readonly string[]) {
  const passThrough: string[] = []
  let targets = 'stable'
  let suite = 'ide-smoke'
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]!
    const name = argument.split('=')[0]
    if (name === '--targets' || name === '--suite') {
      const value = argument.includes('=') ? argument.slice(argument.indexOf('=') + 1) : args[++index]
      if (!value) {
        throw new Error(`${name} requires a value.`)
      }
      if (name === '--targets') {
        targets = value
      }
      else {
        suite = value
      }
    }
    else if (/^--(?:filter|from|roll-from|shard-index|shard-total)=/.test(argument)) {
      passThrough.push(argument)
    }
    else if (name === '--require-official-latest') {
      passThrough.push(argument)
    }
    else {
      throw new Error(`Unknown matrix option: ${argument}`)
    }
  }
  return { requests: parseDevtoolsMatrixTargets(targets), suite, passThrough }
}

/** 矩阵复用正式 suite runner；全程持有一份租约，每一版本沿用原严格策略。 */
export async function runDevtoolsMatrixCli(args = process.argv.slice(2)) {
  const { requests, suite, passThrough } = parseArgs(args)
  const tasks = await getSuiteTasks(suite)
  if (!tasks.length || !suite.startsWith('ide-') || suite.startsWith('ide-headless')) {
    throw new Error('Matrix suite must be an existing real IDE suite.')
  }
  const environmentKeys = DEVTOOLS_SELECTION_ENV_KEYS
  const previous = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]]))
  const parsedPassThrough = splitWechatDevtoolsSelectionArgs(passThrough)
  const strict = parsedPassThrough.selection.requireOfficialLatest
    ?? (process.env.WEAPP_VITE_E2E_REQUIRE_OFFICIAL_LATEST ?? process.env.WEAPP_IDE_REQUIRE_OFFICIAL_LATEST) === '1'
  const scope = createSuiteSignalScope()
  try {
    const result = await withMachineE2ELease(async () => {
      const matrix = await runDevtoolsMatrix(requests, {
        queryOfficial: async request => ({ channel: request.devtoolsChannel, ...await readOfficialWechatDevtoolsVersion(request.devtoolsChannel) }),
        resolve: async (request) => {
          for (const key of environmentKeys) {
            delete process.env[key]
          }
          return await resolveWechatDevtoolsTarget({ ...request, requireOfficialLatest: strict })
        },
        run: async (target) => {
          process.env.WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH = target.cliPath
          process.env.WEAPP_IDE_CLI_PATH = target.cliPath
          process.env.WEAPP_VITE_E2E_DEVTOOLS_CHANNEL = target.channel!
          process.env.WEAPP_VITE_E2E_DEVTOOLS_VERSION = target.version!
          if (strict) {
            process.env.WEAPP_VITE_E2E_REQUIRE_OFFICIAL_LATEST = '1'
          }
          const observation: DevtoolsMatrixRun = { exitCode: 1, runtimeVersions: [] }
          observation.exitCode = await runE2ESuiteCli([suite, ...parsedPassThrough.args], {
            nonInteractive: true,
            onUnsafeRuntime: (reason) => { observation.unsafeReason ??= reason },
            onReport: (report) => {
              observation.suiteReport = path.relative(path.resolve(import.meta.dirname, '../..'), path.join(report.reportDir, report.jsonFile)).replaceAll('\\', '/')
              observation.runtimeVersions = report.tasks.flatMap(task => task.runtimeVersions ?? [])
              observation.suiteAcceptance = report.acceptance
              observation.coverage = report.coverage
              observation.runtimeBlocker = report.tasks.find(task => task.runtimeBlocker)?.runtimeBlocker
              if (report.acceptance === 'incomplete') {
                observation.incompleteReason = 'Suite coverage is partial or contains incomplete tasks'
              }
            },
          }) ?? 1
          if (!observation.suiteReport) {
            observation.incompleteReason = 'Suite report not completed'
          }
          if (!observation.unsafeReason) {
            await inspectExitedWechatInstallation(target)
          }
          return observation
        },
      }, scope.signal)
      return { ...matrix, suite, generatedAt: new Date().toISOString() }
    }).catch((error: unknown) => {
      const reason = error instanceof Error ? error.message : String(error)
      const entries: DevtoolsMatrixEntry[] = requests.map((requested, index) => ({ requested, status: index ? 'not-executed' : 'blocked', exitCode: 1, reason }))
      return { entries, exitCode: 1, suite, generatedAt: new Date().toISOString() }
    })
    const reportRoot = path.resolve(import.meta.dirname, '../../docs/reports/devtools-matrix', new Date().toISOString().replaceAll(':', '-'))
    await fs.mkdir(reportRoot, { recursive: true })
    await fs.writeFile(path.join(reportRoot, 'index.json'), `${JSON.stringify(sanitizeAcceptanceValue(result), null, 2)}\n`)
    const markdown = [`# DevTools 多版本测试`, '', `Suite: ${suite}`, '', '| 目标 | 实际安装 | 结果 | 原因 |', '| --- | --- | --- | --- |', ...result.entries.map(entry => `| ${entry.requested.devtoolsChannel}${entry.requested.devtoolsVersion ? `@${entry.requested.devtoolsVersion}` : ''} | ${entry.selected?.version ?? '未选择'} | ${entry.runtimeBlocker?.code === 'needs-login' ? 'blocked（需要重新登录）' : entry.status} | ${(entry.reason ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ')} |`)]
    await fs.writeFile(path.join(reportRoot, 'index.md'), `${sanitizeAcceptanceValue(markdown.join('\n'))}\n`)
    console.log(`[devtools-matrix] report=${path.relative(path.resolve(import.meta.dirname, '../..'), reportRoot).replaceAll('\\', '/')}`)
    process.exitCode = scope.exitCode ?? result.exitCode
    return result
  }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key]
      }
      else {
        process.env[key] = value
      }
    }
    scope.dispose()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await runDevtoolsMatrixCli()
}
