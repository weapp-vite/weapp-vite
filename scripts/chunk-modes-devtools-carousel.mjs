import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const MODE_OPTIONS = new Set(['manual', 'auto'])
const DEFAULT_MODE = 'manual'
const DEFAULT_INTERVAL_MS = 5000
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const projectScriptPath = path.join(repoRoot, 'scripts', 'chunk-modes-project.mjs')

const scenarios = [
  { id: 'duplicate-common', buildScript: 'build:duplicate:common' },
  { id: 'duplicate-path', buildScript: 'build:duplicate:path' },
  { id: 'duplicate-inline', buildScript: 'build:duplicate:inline' },
  { id: 'hoist-common', buildScript: 'build:hoist:common' },
  { id: 'hoist-path', buildScript: 'build:hoist:path' },
  { id: 'hoist-inline', buildScript: 'build:hoist:inline' },
  { id: 'path-shared-root', buildScript: 'build:path:shared-root' },
  { id: 'path-invalid-root', buildScript: 'build:path:invalid-root' },
  { id: 'warn-on', buildScript: 'build:warn:on' },
  { id: 'warn-off', buildScript: 'build:warn:off' },
  { id: 'warn-zero-threshold', buildScript: 'build:warn:zero-threshold' },
]

const ANSI = {
  reset: '\x1B[0m',
  bold: '\x1B[1m',
  dim: '\x1B[2m',
  black: '\x1B[30m',
  red: '\x1B[31m',
  green: '\x1B[32m',
  yellow: '\x1B[33m',
  blue: '\x1B[34m',
  magenta: '\x1B[35m',
  cyan: '\x1B[36m',
  white: '\x1B[37m',
  bgRed: '\x1B[41m',
  bgGreen: '\x1B[42m',
  bgYellow: '\x1B[43m',
  bgBlue: '\x1B[44m',
  bgMagenta: '\x1B[45m',
  bgCyan: '\x1B[46m',
}

function color(text, ...styles) {
  return `${styles.join('')}${text}${ANSI.reset}`
}

function printHelp() {
  console.log(`Usage: node scripts/chunk-modes-devtools-carousel.mjs [--mode manual|auto] [--interval <ms>]

Modes:
  manual  Build and open one scenario, wait for Enter, then move to the next scenario.
  auto    Build and open one scenario, wait for the interval, then move to the next scenario automatically.

Examples:
  node scripts/chunk-modes-devtools-carousel.mjs --mode manual
  node scripts/chunk-modes-devtools-carousel.mjs --mode auto --interval 5000
`)
}

function parseArgs(argv) {
  let mode = DEFAULT_MODE
  let intervalMs = DEFAULT_INTERVAL_MS

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
    if (arg === '--mode') {
      mode = argv[i + 1] ?? mode
      i += 1
      continue
    }
    if (arg === '--interval') {
      const parsed = Number.parseInt(argv[i + 1] ?? '', 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        intervalMs = parsed
      }
      i += 1
    }
  }

  if (!MODE_OPTIONS.has(mode)) {
    throw new Error(`Unsupported mode: ${mode}`)
  }

  return { mode, intervalMs }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function waitForEnter(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    rl.question(message, () => {
      rl.close()
      resolve()
    })
  })
}

function formatScenario(id) {
  const parts = id.split('-')
  const strategy = parts[0] ?? 'unknown'
  const mode = parts[1] ?? 'unknown'
  const extra = parts.slice(2).join('-') || ''

  const strategyColor = strategy === 'duplicate'
    ? [ANSI.bold, ANSI.bgBlue, ANSI.white]
    : strategy === 'hoist'
      ? [ANSI.bold, ANSI.bgMagenta, ANSI.white]
      : [ANSI.bold, ANSI.bgCyan, ANSI.black]

  const modeColor = mode === 'common'
    ? [ANSI.bold, ANSI.green]
    : mode === 'path'
      ? [ANSI.bold, ANSI.yellow]
      : mode === 'inline'
        ? [ANSI.bold, ANSI.red]
        : [ANSI.bold, ANSI.cyan]

  const extraColor = extra.includes('warn')
    ? [ANSI.bold, ANSI.bgYellow, ANSI.black]
    : extra
      ? [ANSI.bold, ANSI.bgCyan, ANSI.black]
      : [ANSI.dim, ANSI.white]

  return {
    id: color(id, ANSI.bold, ANSI.white),
    strategy: color(strategy.toUpperCase(), ...strategyColor),
    mode: color(mode.toUpperCase(), ...modeColor),
    extra: extra
      ? color(extra.toUpperCase(), ...extraColor)
      : color('BASE', ANSI.dim, ANSI.white),
  }
}

function printScenarioBanner(id, index, total) {
  const formatted = formatScenario(id)
  const line = color('='.repeat(88), ANSI.bold, ANSI.cyan)
  console.log(`\n${line}`)
  console.log(color(`[chunk-modes] scenario ${index + 1}/${total}`, ANSI.bold, ANSI.white), formatted.id)
  console.log(
    color('[chunk-modes] profile', ANSI.bold, ANSI.white),
    `strategy=${formatted.strategy}`,
    `mode=${formatted.mode}`,
    `tag=${formatted.extra}`,
  )
  console.log(`${line}`)
}

async function runCommand(command, args, options = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      stdio: 'inherit',
      env: options.env ?? process.env,
    })

    child.once('error', reject)
    child.once('exit', (code, signal) => {
      resolve({ code, signal })
    })
  })
}

async function runScenario(scenario, index, total, options) {
  printScenarioBanner(scenario.id, index, total)

  const result = await runCommand('node', [projectScriptPath, '--scenario', scenario.id, '--open'], {
    cwd: repoRoot,
    env: process.env,
  })

  if ((result.code ?? 1) !== 0) {
    throw new Error(`Scenario ${scenario.id} failed with code ${result.code ?? 'null'}`)
  }

  if (options.mode === 'manual') {
    await waitForEnter(`[chunk-modes] ${scenario.id} 已打开独立项目。检查完微信开发者工具后按回车进入下一个场景...`)
  }
  else {
    console.log(`[chunk-modes] ${scenario.id} 已打开独立项目，${options.intervalMs}ms 后自动切换到下一个场景。`)
    await wait(options.intervalMs)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  console.log(`[chunk-modes] mode=${options.mode}${options.mode === 'auto' ? ` interval=${options.intervalMs}ms` : ''}`)
  console.log(`[chunk-modes] scenarios=${scenarios.map(item => item.id).join(', ')}`)

  for (let i = 0; i < scenarios.length; i += 1) {
    await runScenario(scenarios[i], i, scenarios.length, options)
  }

  console.log('\n[chunk-modes] all scenarios completed')
}

main().catch((error) => {
  console.error(`[chunk-modes] failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
