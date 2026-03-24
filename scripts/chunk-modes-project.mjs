import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const chunkModesRoot = path.join(repoRoot, 'e2e-apps', 'chunk-modes')
const cliPath = path.join(repoRoot, 'packages', 'weapp-vite', 'bin', 'weapp-vite.js')
const distMatrixRoot = path.join(chunkModesRoot, 'dist-matrix')

const scenarios = {
  'duplicate-common': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'common',
  },
  'duplicate-path': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_SHARED_PATH_ROOT: 'src',
  },
  'duplicate-inline': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'inline',
  },
  'hoist-common': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'common',
  },
  'hoist-path': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_SHARED_PATH_ROOT: 'src',
  },
  'hoist-inline': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'inline',
  },
  'path-shared-root': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_SHARED_PATH_ROOT: 'shared',
  },
  'path-invalid-root': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_SHARED_PATH_ROOT: 'invalid',
  },
  'warn-on': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_LOG_OPTIMIZATION: 'true',
    WEAPP_CHUNK_DUPLICATE_WARNING_BYTES: '1',
  },
  'warn-off': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_LOG_OPTIMIZATION: 'false',
    WEAPP_CHUNK_DUPLICATE_WARNING_BYTES: '1',
  },
  'warn-zero-threshold': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_LOG_OPTIMIZATION: 'true',
    WEAPP_CHUNK_DUPLICATE_WARNING_BYTES: '0',
  },
}

function printHelp() {
  console.log(`Usage: node scripts/chunk-modes-project.mjs --scenario <id> [--open]

Scenarios:
${Object.keys(scenarios).map(id => `  - ${id}`).join('\n')}
`)
}

function parseArgs(argv) {
  let scenarioId = ''
  let shouldOpen = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
    if (arg === '--scenario') {
      scenarioId = argv[i + 1] ?? scenarioId
      i += 1
      continue
    }
    if (arg === '--open') {
      shouldOpen = true
    }
  }

  if (!scenarioId) {
    throw new Error('Missing required --scenario <id>')
  }
  if (!Object.hasOwn(scenarios, scenarioId)) {
    throw new Error(`Unsupported scenario: ${scenarioId}`)
  }

  return { scenarioId, shouldOpen }
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

async function prepareScenarioProject(scenarioId) {
  const targetRoot = path.join(distMatrixRoot, scenarioId)
  const targetDist = path.join(targetRoot, 'dist')

  await fs.rm(targetRoot, { recursive: true, force: true })
  await fs.mkdir(targetRoot, { recursive: true })

  const projectConfig = JSON.parse(await fs.readFile(path.join(chunkModesRoot, 'project.config.json'), 'utf8'))
  projectConfig.projectname = `shared-chunk-modes-${scenarioId}`
  projectConfig.miniprogramRoot = 'dist'
  await fs.writeFile(path.join(targetRoot, 'project.config.json'), `${JSON.stringify(projectConfig, null, 2)}\n`)

  const privateConfig = await fs.readFile(path.join(chunkModesRoot, 'project.private.config.json'), 'utf8')
  await fs.writeFile(path.join(targetRoot, 'project.private.config.json'), privateConfig)

  return {
    targetRoot,
    targetDist,
  }
}

async function main() {
  const { scenarioId, shouldOpen } = parseArgs(process.argv.slice(2))
  const scenarioEnv = scenarios[scenarioId]
  const { targetRoot, targetDist } = await prepareScenarioProject(scenarioId)

  const buildResult = await runCommand('node', [
    cliPath,
    'build',
    chunkModesRoot,
    '--platform',
    'weapp',
    '--skipNpm',
    '--config',
    path.join(chunkModesRoot, 'weapp-vite.config.ts'),
  ], {
    cwd: chunkModesRoot,
    env: {
      ...process.env,
      ...scenarioEnv,
      WEAPP_CHUNK_OUTDIR: path.relative(chunkModesRoot, targetDist),
    },
  })

  if ((buildResult.code ?? 1) !== 0) {
    throw new Error(`Build failed for scenario ${scenarioId}`)
  }

  if (!shouldOpen) {
    return
  }

  const openResult = await runCommand('node', [
    cliPath,
    'open',
    targetRoot,
    '--platform',
    'weapp',
  ], {
    cwd: repoRoot,
    env: process.env,
  })

  if ((openResult.code ?? 1) !== 0) {
    throw new Error(`Open failed for scenario ${scenarioId}`)
  }
}

main().catch((error) => {
  console.error(`[chunk-modes-project] failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
