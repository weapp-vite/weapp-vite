import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

export type VscodeE2EScenarioId = 'standalone' | 'vue-official'

interface VscodeE2EScenario {
  extensions: string[]
  id: VscodeE2EScenarioId
  label: string
}

interface PreparedVscodeScenario {
  cleanup: () => Promise<void>
  extensionsDir: string
  fixturePath: string
  harnessPath: string
  scenario: VscodeE2EScenario
  userDataDir: string
  vscodeExecutablePath: string
}

export const VUE_OFFICIAL_EXTENSION_ID = process.env.WEAPP_VITE_VUE_OFFICIAL_EXTENSION_ID || 'Vue.volar'

const SCENARIOS: Record<VscodeE2EScenarioId, VscodeE2EScenario> = {
  'standalone': {
    id: 'standalone',
    label: '仅安装 weapp-vite 扩展',
    extensions: [],
  },
  'vue-official': {
    id: 'vue-official',
    label: '安装 weapp-vite 扩展 + Vue Official',
    extensions: [VUE_OFFICIAL_EXTENSION_ID],
  },
}

export const DEFAULT_VSCODE_USER_SETTINGS = {
  'security.workspace.trust.enabled': false,
}

function isScenarioId(value: string): value is VscodeE2EScenarioId {
  return value === 'standalone' || value === 'vue-official'
}

export function resolveScenarioIds(argument = process.argv[2]) {
  if (!argument || argument === 'all') {
    return Object.keys(SCENARIOS) as VscodeE2EScenarioId[]
  }

  if (!isScenarioId(argument)) {
    throw new Error(`未知场景: ${argument}，可选值为 standalone、vue-official、all`)
  }

  return [argument]
}

export async function resolveVscodeTestElectron() {
  const moduleName = '@vscode/test-electron'

  try {
    return await import(moduleName)
  }
  catch (error) {
    throw new Error([
      '缺少 @vscode/test-electron，暂时无法运行 VS Code 安装态 e2e。',
      '请先在仓库根目录安装该依赖后再执行：pnpm --dir extensions/vscode run test:vsix:e2e',
      `原始错误: ${error instanceof Error ? error.message : String(error)}`,
    ].join('\n'))
  }
}

function getLaunchArgs(
  fixturePath: string,
  extensionsDir: string,
  userDataDir: string,
  extraArgs: string[] = [],
) {
  return [
    fixturePath,
    `--extensions-dir=${extensionsDir}`,
    `--user-data-dir=${userDataDir}`,
    '--disable-workspace-trust',
    '--skip-welcome',
    '--skip-release-notes',
    ...extraArgs,
  ]
}

function installExtension(
  cliPath: string,
  cliBaseArgs: string[],
  extensionsDir: string,
  userDataDir: string,
  extensionReference: string,
) {
  const installResult = spawnSync(
    cliPath,
    [
      ...cliBaseArgs,
      `--extensions-dir=${extensionsDir}`,
      `--user-data-dir=${userDataDir}`,
      '--install-extension',
      extensionReference,
      '--force',
    ],
    {
      shell: process.platform === 'win32',
      stdio: 'inherit',
    },
  )

  if (installResult.status !== 0) {
    throw new Error(`安装扩展失败: ${extensionReference}`)
  }
}

export async function ensureVscodeUserSettings(userDataDir: string, overrides: Record<string, unknown> = {}) {
  const settingsPath = path.join(userDataDir, 'User', 'settings.json')
  let existingSettings: Record<string, unknown> = {}

  try {
    existingSettings = JSON.parse(await fs.readFile(settingsPath, 'utf8'))
  }
  catch (error) {
    const nodeError = error as NodeJS.ErrnoException

    if (nodeError.code !== 'ENOENT') {
      throw error
    }
  }

  await fs.mkdir(path.dirname(settingsPath), { recursive: true })
  await fs.writeFile(
    settingsPath,
    `${JSON.stringify({
      ...existingSettings,
      ...DEFAULT_VSCODE_USER_SETTINGS,
      ...overrides,
    }, null, 2)}\n`,
    'utf8',
  )
}

export async function prepareVscodeScenario(scenarioId: VscodeE2EScenarioId): Promise<PreparedVscodeScenario> {
  const scenario = SCENARIOS[scenarioId]
  const extensionRoot = path.resolve(process.cwd())
  const fixturePath = path.join(extensionRoot, 'scripts', 'fixtures', 'vscode-host-smoke')
  const harnessPath = path.join(extensionRoot, 'scripts', 'fixtures', 'vscode-vsix-test-harness')
  const vsixPath = path.join(extensionRoot, '.artifacts', 'weapp-vite.vsix')
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), `weapp-vite-vscode-${scenario.id}-user-`))
  const extensionsDir = await fs.mkdtemp(path.join(os.tmpdir(), `weapp-vite-vscode-${scenario.id}-exts-`))

  try {
    await fs.access(vsixPath)
    await fs.access(path.join(harnessPath, 'package.json'))
    await fs.access(path.join(harnessPath, 'extension.js'))

    const {
      downloadAndUnzipVSCode,
      resolveCliArgsFromVSCodeExecutablePath,
    } = await resolveVscodeTestElectron()
    const vscodeExecutablePath = await downloadAndUnzipVSCode()
    const [cliPath, ...cliBaseArgs] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath, {
      reuseMachineInstall: true,
    })

    await ensureVscodeUserSettings(userDataDir)
    installExtension(cliPath, cliBaseArgs, extensionsDir, userDataDir, vsixPath)

    for (const extensionReference of scenario.extensions) {
      installExtension(cliPath, cliBaseArgs, extensionsDir, userDataDir, extensionReference)
    }

    return {
      cleanup: async () => {
        await fs.rm(userDataDir, { force: true, recursive: true })
        await fs.rm(extensionsDir, { force: true, recursive: true })
      },
      extensionsDir,
      fixturePath,
      harnessPath,
      scenario,
      userDataDir,
      vscodeExecutablePath,
    }
  }
  catch (error) {
    await fs.rm(userDataDir, { force: true, recursive: true })
    await fs.rm(extensionsDir, { force: true, recursive: true })
    throw error
  }
}

export async function launchPreparedVscodeScenario(prepared: PreparedVscodeScenario, extraArgs: string[] = []) {
  console.log(`启动场景: ${prepared.scenario.label}`)
  console.log(`user data dir: ${prepared.userDataDir}`)
  console.log(`extensions dir: ${prepared.extensionsDir}`)

  const child = spawn(
    prepared.vscodeExecutablePath,
    getLaunchArgs(prepared.fixturePath, prepared.extensionsDir, prepared.userDataDir, extraArgs),
    {
      shell: process.platform === 'win32',
      stdio: 'inherit',
    },
  )

  const forwardSignal = (signal: NodeJS.Signals) => {
    child.kill(signal)
  }

  process.on('SIGINT', forwardSignal)
  process.on('SIGTERM', forwardSignal)

  try {
    const exitCode = await new Promise<number>((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', code => resolve(code ?? 0))
    })

    if (exitCode !== 0) {
      process.exit(exitCode)
    }
  }
  finally {
    process.off('SIGINT', forwardSignal)
    process.off('SIGTERM', forwardSignal)
    await prepared.cleanup()
  }
}

export function getScenarioRunnerEnv(scenarioId: VscodeE2EScenarioId) {
  return {
    WEAPP_VITE_EXPECT_VUE_OFFICIAL: scenarioId === 'vue-official' ? '1' : '0',
    WEAPP_VITE_VSIX_ID: 'weapp-vite.weapp-vite',
    WEAPP_VITE_VUE_OFFICIAL_EXTENSION_ID: VUE_OFFICIAL_EXTENSION_ID,
  }
}
