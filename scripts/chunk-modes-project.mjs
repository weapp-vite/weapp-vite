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

const baseScenarios = {
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
  'path-root-shared': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_SHARED_PATH_ROOT: 'shared',
  },
  'path-invalid-root': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_SHARED_PATH_ROOT: 'invalid',
  },
  'path-root-invalid': {
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

const scenarios = {
  ...baseScenarios,
  'duplicate-common-none-preserve': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'common',
    WEAPP_CHUNK_OVERRIDE: 'none',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'duplicate-common-path-preserve': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'common',
    WEAPP_CHUNK_OVERRIDE: 'path',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'duplicate-common-inline-preserve': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'common',
    WEAPP_CHUNK_OVERRIDE: 'inline',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'duplicate-common-mixed-preserve': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'common',
    WEAPP_CHUNK_OVERRIDE: 'mixed',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'duplicate-common-none-inline': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'common',
    WEAPP_CHUNK_OVERRIDE: 'none',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'duplicate-common-path-inline': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'common',
    WEAPP_CHUNK_OVERRIDE: 'path',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'duplicate-common-inline-inline': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'common',
    WEAPP_CHUNK_OVERRIDE: 'inline',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'duplicate-common-mixed-inline': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'common',
    WEAPP_CHUNK_OVERRIDE: 'mixed',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'duplicate-path-none-preserve': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_OVERRIDE: 'none',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'duplicate-path-path-preserve': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_OVERRIDE: 'path',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'duplicate-path-inline-preserve': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_OVERRIDE: 'inline',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'duplicate-path-mixed-preserve': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_OVERRIDE: 'mixed',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'duplicate-path-none-inline': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_OVERRIDE: 'none',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'duplicate-path-path-inline': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_OVERRIDE: 'path',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'duplicate-path-inline-inline': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_OVERRIDE: 'inline',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'duplicate-path-mixed-inline': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_OVERRIDE: 'mixed',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'duplicate-inline-none-preserve': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'inline',
    WEAPP_CHUNK_OVERRIDE: 'none',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'duplicate-inline-path-preserve': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'inline',
    WEAPP_CHUNK_OVERRIDE: 'path',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'duplicate-inline-inline-preserve': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'inline',
    WEAPP_CHUNK_OVERRIDE: 'inline',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'duplicate-inline-mixed-preserve': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'inline',
    WEAPP_CHUNK_OVERRIDE: 'mixed',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'duplicate-inline-none-inline': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'inline',
    WEAPP_CHUNK_OVERRIDE: 'none',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'duplicate-inline-path-inline': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'inline',
    WEAPP_CHUNK_OVERRIDE: 'path',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'duplicate-inline-inline-inline': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'inline',
    WEAPP_CHUNK_OVERRIDE: 'inline',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'duplicate-inline-mixed-inline': {
    WEAPP_CHUNK_STRATEGY: 'duplicate',
    WEAPP_CHUNK_MODE: 'inline',
    WEAPP_CHUNK_OVERRIDE: 'mixed',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'hoist-common-none-preserve': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'common',
    WEAPP_CHUNK_OVERRIDE: 'none',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'hoist-common-path-preserve': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'common',
    WEAPP_CHUNK_OVERRIDE: 'path',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'hoist-common-inline-preserve': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'common',
    WEAPP_CHUNK_OVERRIDE: 'inline',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'hoist-common-mixed-preserve': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'common',
    WEAPP_CHUNK_OVERRIDE: 'mixed',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'hoist-common-none-inline': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'common',
    WEAPP_CHUNK_OVERRIDE: 'none',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'hoist-common-path-inline': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'common',
    WEAPP_CHUNK_OVERRIDE: 'path',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'hoist-common-inline-inline': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'common',
    WEAPP_CHUNK_OVERRIDE: 'inline',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'hoist-common-mixed-inline': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'common',
    WEAPP_CHUNK_OVERRIDE: 'mixed',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'hoist-path-none-preserve': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_OVERRIDE: 'none',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'hoist-path-path-preserve': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_OVERRIDE: 'path',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'hoist-path-inline-preserve': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_OVERRIDE: 'inline',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'hoist-path-mixed-preserve': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_OVERRIDE: 'mixed',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'hoist-path-none-inline': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_OVERRIDE: 'none',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'hoist-path-path-inline': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_OVERRIDE: 'path',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'hoist-path-inline-inline': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_OVERRIDE: 'inline',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'hoist-path-mixed-inline': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'path',
    WEAPP_CHUNK_OVERRIDE: 'mixed',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'hoist-inline-none-preserve': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'inline',
    WEAPP_CHUNK_OVERRIDE: 'none',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'hoist-inline-path-preserve': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'inline',
    WEAPP_CHUNK_OVERRIDE: 'path',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'hoist-inline-inline-preserve': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'inline',
    WEAPP_CHUNK_OVERRIDE: 'inline',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'hoist-inline-mixed-preserve': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'inline',
    WEAPP_CHUNK_OVERRIDE: 'mixed',
    WEAPP_CHUNK_DYNAMIC: 'preserve',
  },
  'hoist-inline-none-inline': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'inline',
    WEAPP_CHUNK_OVERRIDE: 'none',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'hoist-inline-path-inline': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'inline',
    WEAPP_CHUNK_OVERRIDE: 'path',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'hoist-inline-inline-inline': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'inline',
    WEAPP_CHUNK_OVERRIDE: 'inline',
    WEAPP_CHUNK_DYNAMIC: 'inline',
  },
  'hoist-inline-mixed-inline': {
    WEAPP_CHUNK_STRATEGY: 'hoist',
    WEAPP_CHUNK_MODE: 'inline',
    WEAPP_CHUNK_OVERRIDE: 'mixed',
    WEAPP_CHUNK_DYNAMIC: 'inline',
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
  await fs.writeFile(path.join(targetRoot, 'project.config.json'), JSON.stringify(projectConfig, null, 2))

  const privateConfig = await fs.readFile(path.join(chunkModesRoot, 'project.private.config.json'), 'utf8')
  await fs.writeFile(path.join(targetRoot, 'project.private.config.json'), privateConfig)

  const sourcePackageJson = JSON.parse(await fs.readFile(path.join(chunkModesRoot, 'package.json'), 'utf8'))
  const scenarioPackageJson = {
    name: `${sourcePackageJson.name}-${scenarioId}`,
    private: true,
    type: sourcePackageJson.type ?? 'module',
  }
  await fs.writeFile(path.join(targetRoot, 'package.json'), `${JSON.stringify(scenarioPackageJson, null, 2)}\n`)

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
      WEAPP_CHUNK_SCENARIO: scenarioId,
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
