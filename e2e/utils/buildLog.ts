/* eslint-disable e18e/ban-dependencies -- e2e 构建日志采集需要 execa 驱动 CLI，并使用 shared fs 清理构建产物。 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fs as fsExtra } from '@weapp-core/shared/node'
import { execa } from 'execa'
import { appendIdeReportEvent, resolveReportProjectPath } from './ideWarningReport'
import { resolveJsFormatConfigOverride } from './jsFormat'

const WARN_PATTERN = /\[warn\]/i
const ERROR_PATTERN = /\[error\]/i
const CARRIAGE_RETURN_AT_EOL_PATTERN = /\r$/
const MINIPROGRAM_NPM_EEXIST_PATTERN = /EEXIST: file already exists, mkdir .*miniprogram_npm/
const PRINTED_SKIP_NPM_GUARDS = new Set<string>()

interface BuildLogStats {
  warn: number
  error: number
}

interface BuildCommandOptions {
  cliPath: string
  configFile?: string
  jsFormat?: 'cjs' | 'esm'
  projectRoot: string
  platform: 'weapp' | 'alipay' | 'tt'
  cwd?: string
  label?: string
  skipNpm?: boolean
  env?: Record<string, string | undefined>
}

interface DependencyMeta {
  count: number
  source: 'dependencies' | 'none'
}

const BUILD_ENV_STRIP_PREFIXES = [
  'npm_lifecycle_',
  'npm_package_',
]

const BUILD_ENV_STRIP_KEYS = new Set([
  'PNPM_PACKAGE_NAME',
  'PNPM_SCRIPT_SRC_DIR',
])

function createSkipNpmGuardKey(label: string, projectRoot: string, dependencyMeta: DependencyMeta) {
  return `${label}::${projectRoot}::${dependencyMeta.source}::${dependencyMeta.count}`
}

async function removeDirWithRetry(target: string, retries = 3) {
  let lastError: unknown
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await fsExtra.remove(target)
      if (!(await fsExtra.pathExists(target))) {
        return
      }
    }
    catch (error) {
      lastError = error
    }
    await new Promise(resolve => setTimeout(resolve, 200 * attempt))
  }
  if (lastError) {
    throw lastError
  }
}

function collectLineStats(line: string, stats: BuildLogStats, project: string, label: string) {
  if (WARN_PATTERN.test(line)) {
    stats.warn += 1
    appendIdeReportEvent({
      source: 'build',
      kind: 'message',
      project,
      label,
      level: 'warn',
      channel: 'build',
      text: line,
    })
  }
  if (ERROR_PATTERN.test(line)) {
    stats.error += 1
    appendIdeReportEvent({
      source: 'build',
      kind: 'message',
      project,
      label,
      level: 'error',
      channel: 'build',
      text: line,
    })
  }
}

function createLineCollector(stats: BuildLogStats, project: string, label: string) {
  let pending = ''

  return {
    write(chunk: string) {
      pending += chunk
      let index = pending.indexOf('\n')
      while (index >= 0) {
        const line = pending.slice(0, index).replace(CARRIAGE_RETURN_AT_EOL_PATTERN, '')
        pending = pending.slice(index + 1)
        collectLineStats(line, stats, project, label)
        index = pending.indexOf('\n')
      }
    },
    flush() {
      const line = pending.trim()
      if (!line) {
        return
      }
      collectLineStats(line, stats, project, label)
      pending = ''
    },
  }
}

function readDependencyMeta(projectRoot: string): DependencyMeta {
  const packageJsonPath = path.resolve(projectRoot, 'package.json')
  if (!fs.existsSync(packageJsonPath)) {
    return {
      count: 0,
      source: 'none',
    }
  }

  try {
    const raw = fs.readFileSync(packageJsonPath, 'utf-8')
    const pkg = JSON.parse(raw) as Record<string, any>
    const dependencies = pkg?.dependencies && typeof pkg.dependencies === 'object'
      ? Object.keys(pkg.dependencies)
      : []
    if (dependencies.length > 0) {
      return {
        count: dependencies.length,
        source: 'dependencies',
      }
    }
  }
  catch {
    // 忽略 package.json 解析异常，回退为不触发 guard。
  }

  return {
    count: 0,
    source: 'none',
  }
}

export function sanitizeBuildCommandEnv(env = process.env) {
  const nextEnv: Record<string, string> = {}

  for (const [key, value] of Object.entries(env)) {
    if (typeof value !== 'string') {
      continue
    }
    if (BUILD_ENV_STRIP_KEYS.has(key)) {
      continue
    }
    if (BUILD_ENV_STRIP_PREFIXES.some(prefix => key.startsWith(prefix))) {
      continue
    }
    nextEnv[key] = value
  }

  return nextEnv
}

export async function runWeappViteBuildWithLogCapture(options: BuildCommandOptions) {
  const {
    cliPath,
    configFile,
    jsFormat,
    projectRoot,
    platform,
    cwd,
    label = projectRoot,
    skipNpm = false,
    env,
  } = options

  const stats: BuildLogStats = {
    warn: 0,
    error: 0,
  }
  const reportProject = resolveReportProjectPath(projectRoot)

  const dependencyMeta = readDependencyMeta(projectRoot)
  const safeSkipNpm = skipNpm && dependencyMeta.count === 0
  if (skipNpm && !safeSkipNpm) {
    const guardKey = createSkipNpmGuardKey(label, projectRoot, dependencyMeta)
    if (!PRINTED_SKIP_NPM_GUARDS.has(guardKey)) {
      PRINTED_SKIP_NPM_GUARDS.add(guardKey)
      const guardLine = `[e2e-build-guard] label=${label} project=${projectRoot} skipNpm=true ignored due to ${dependencyMeta.source}(${dependencyMeta.count}); duplicate notices suppressed for this process`
      process.stdout.write(`${guardLine}\n`)
    }
  }

  const distRoot = path.resolve(projectRoot, 'dist')
  const configOverride = await resolveJsFormatConfigOverride({
    configFile,
    jsFormat,
    projectRoot,
  })
  const args = [cliPath, 'build', projectRoot, '--platform', platform]
  if (safeSkipNpm) {
    args.push('--skipNpm')
  }
  if (configOverride.configFile) {
    args.push('--config', configOverride.configFile)
  }

  async function runBuildCommand() {
    await removeDirWithRetry(distRoot)
    let fullOutput = ''
    const subprocess = execa('node', args, {
      cwd,
      all: true,
      extendEnv: false,
      env: {
        ...sanitizeBuildCommandEnv(),
        ...env,
      },
      reject: false,
    })

    const collector = createLineCollector(stats, reportProject, label)
    subprocess.all?.on('data', (chunk) => {
      const text = chunk.toString()
      fullOutput += text
      process.stdout.write(text)
      collector.write(text)
    })

    const result = await subprocess
    collector.flush()
    return { result, fullOutput }
  }

  try {
    let { result, fullOutput } = await runBuildCommand()
    if ((result.exitCode ?? 1) !== 0) {
      const reason = MINIPROGRAM_NPM_EEXIST_PATTERN.test(fullOutput)
        ? 'miniprogram_npm mkdir EEXIST'
        : 'build exit non-zero'
      const retryLine = `[e2e-build-retry] label=${label} reason=${reason}`
      process.stdout.write(`${retryLine}\n`)
      ;({ result, fullOutput } = await runBuildCommand())
    }

    const summary = `[e2e-build-stats] label=${label} warn=${stats.warn} error=${stats.error} exit=${result.exitCode ?? 1}`
    if ((result.exitCode ?? 1) === 0) {
      process.stdout.write(`${summary}\n`)
    }
    else {
      process.stderr.write(`${summary}\n`)
      throw new Error(`Build failed: node ${args.join(' ')}`)
    }
    appendIdeReportEvent({
      source: 'build',
      kind: 'stats',
      project: reportProject,
      label,
      warn: stats.warn,
      error: stats.error,
      exit: result.exitCode ?? 1,
    })

    return stats
  }
  finally {
    await configOverride.cleanup()
  }
}
