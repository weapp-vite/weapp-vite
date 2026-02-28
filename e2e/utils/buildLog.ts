import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'

const WARN_PATTERN = /\[warn\]/i
const ERROR_PATTERN = /\[error\]/i
const BUILD_LOG_FILE = process.env.WEAPP_VITE_E2E_BUILD_LOG_FILE || '/tmp/weapp-vite-e2e-build.log'

interface BuildLogStats {
  warn: number
  error: number
}

interface BuildCommandOptions {
  cliPath: string
  projectRoot: string
  platform: 'weapp' | 'alipay' | 'tt'
  cwd?: string
  label?: string
  skipNpm?: boolean
}

interface DependencyMeta {
  count: number
  source: 'dependencies' | 'none'
}

function appendBuildLog(line: string) {
  try {
    fs.appendFileSync(BUILD_LOG_FILE, `${line}\n`)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`[e2e-log-write-error] build-log file=${BUILD_LOG_FILE} error=${message}\n`)
  }
}

function collectLineStats(line: string, stats: BuildLogStats) {
  let matched = false
  if (WARN_PATTERN.test(line)) {
    stats.warn += 1
    matched = true
  }
  if (ERROR_PATTERN.test(line)) {
    stats.error += 1
    matched = true
  }
  if (matched) {
    appendBuildLog(`[build-log] ${line}`)
  }
}

function createLineCollector(stats: BuildLogStats) {
  let pending = ''

  return {
    write(chunk: string) {
      pending += chunk
      let index = pending.indexOf('\n')
      while (index >= 0) {
        const line = pending.slice(0, index).replace(/\r$/, '')
        pending = pending.slice(index + 1)
        collectLineStats(line, stats)
        index = pending.indexOf('\n')
      }
    },
    flush() {
      const line = pending.trim()
      if (!line) {
        return
      }
      collectLineStats(line, stats)
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

export async function runWeappViteBuildWithLogCapture(options: BuildCommandOptions) {
  const {
    cliPath,
    projectRoot,
    platform,
    cwd,
    label = projectRoot,
    skipNpm = false,
  } = options

  const stats: BuildLogStats = {
    warn: 0,
    error: 0,
  }

  const dependencyMeta = readDependencyMeta(projectRoot)
  const safeSkipNpm = skipNpm && dependencyMeta.count === 0
  if (skipNpm && !safeSkipNpm) {
    const guardLine = `[e2e-build-guard] label=${label} project=${projectRoot} skipNpm=true ignored due to ${dependencyMeta.source}(${dependencyMeta.count})`
    process.stdout.write(`${guardLine}\n`)
    appendBuildLog(guardLine)
  }

  const args = [cliPath, 'build', projectRoot, '--platform', platform]
  if (safeSkipNpm) {
    args.push('--skipNpm')
  }

  const subprocess = execa('node', args, {
    cwd,
    all: true,
    reject: false,
  })

  const collector = createLineCollector(stats)
  subprocess.all?.on('data', (chunk) => {
    const text = chunk.toString()
    process.stdout.write(text)
    collector.write(text)
  })

  const result = await subprocess
  collector.flush()

  const summary = `[e2e-build-stats] label=${label} warn=${stats.warn} error=${stats.error} exit=${result.exitCode ?? 1}`
  if ((result.exitCode ?? 1) === 0) {
    process.stdout.write(`${summary}\n`)
  }
  else {
    process.stderr.write(`${summary}\n`)
    appendBuildLog(summary)
    throw new Error(`Build failed: node ${args.join(' ')}`)
  }
  appendBuildLog(summary)

  return stats
}
