import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

type Action = 'preview' | 'upload'
type CliFlagMap = Record<string, string | boolean>

interface ProjectConfig {
  appid?: string
  compileType?: string
}

interface ResolvedOptions {
  action: Action
  project: string
  projectRoot: string
  privateKeyPath: string
  appid: string
  robot: number
  version: string
  desc: string
  pagePath?: string
  searchQuery?: string
  scene?: number
  qrcodeFormat: 'terminal' | 'image' | 'base64'
  qrcodeOutputDest?: string
  sourceMapSavePath?: string
  skipBuild: boolean
  projectType: 'miniProgram' | 'miniGame' | 'plugin'
}

const QRCODE_FORMATS = new Set<ResolvedOptions['qrcodeFormat']>(['terminal', 'image', 'base64'])
const ENV_FILE_NAMES = ['.env.local', '.env.development.local']
const ISOLATED_RUNNER_DIR = path.resolve(process.cwd(), 'tools/miniprogram-ci-runner')
const ISOLATED_RUNNER_ENTRY = path.join(ISOLATED_RUNNER_DIR, 'run.mjs')
const ISOLATED_RUNNER_NODE_MODULES = path.join(ISOLATED_RUNNER_DIR, 'node_modules', 'miniprogram-ci')

/**
 * @description 解析简单的 dotenv 文件，仅覆盖当前进程中尚未显式设置的变量。
 */
function parseEnvFile(content: string) {
  const entries: Record<string, string> = {}

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const equalsIndex = line.indexOf('=')
    if (equalsIndex <= 0) {
      continue
    }

    const key = line.slice(0, equalsIndex).trim()
    let value = line.slice(equalsIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith('\'') && value.endsWith('\''))
    ) {
      value = value.slice(1, -1)
    }

    if (key) {
      entries[key] = value
    }
  }

  return entries
}

/**
 * @description 从仓库根目录与目标项目目录加载本地环境变量，避免把密钥写进版本库。
 */
async function loadLocalEnvFiles(projectRoot?: string) {
  const candidateDirs = [process.cwd()]
  if (projectRoot) {
    candidateDirs.push(projectRoot)
  }

  for (const dir of candidateDirs) {
    for (const fileName of ENV_FILE_NAMES) {
      const filePath = path.join(dir, fileName)
      try {
        const content = await fs.readFile(filePath, 'utf8')
        const parsed = parseEnvFile(content)
        for (const [key, value] of Object.entries(parsed)) {
          if (process.env[key] === undefined) {
            process.env[key] = value
          }
        }
      }
      catch {
        continue
      }
    }
  }
}

const HELP_TEXT = `
用法:
  pnpm weapp:ci:setup
  pnpm weapp:ci:preview -- --project apps/mcp-demo
  pnpm weapp:ci:upload -- --project apps/mcp-demo --version 1.0.0 --desc "ci upload"

参数:
  --project <path>               目标小程序项目目录，默认读取 WEAPP_CI_PROJECT
  --private-key <path>           上传密钥路径，默认读取 WEAPP_CI_PRIVATE_KEY_PATH
  --appid <appid>                覆盖 project.config.json 中的 appid
  --robot <1-30>                 指定 CI 机器人，默认 1
  --version <value>              上传/预览版本号，默认取项目 package.json 的 version
  --desc <text>                  上传/预览备注
  --page <path>                  预览页面路径
  --query <text>                 预览页面 query
  --scene <number>               预览 scene
  --qrcode-format <value>        terminal/image/base64，默认 image
  --qrcode-output <path>         预览二维码输出路径
  --source-map-save-path <path>  预览 sourcemap 输出目录
  --skip-build                   跳过预构建
  --help                         显示帮助

环境变量:
  WEAPP_CI_PROJECT
  WEAPP_CI_PRIVATE_KEY_PATH
  WEAPP_CI_APPID
  WEAPP_CI_ROBOT
  WEAPP_CI_VERSION
  WEAPP_CI_DESC
  WEAPP_CI_PAGE_PATH
  WEAPP_CI_SEARCH_QUERY
  WEAPP_CI_SCENE
  WEAPP_CI_QRCODE_FORMAT
  WEAPP_CI_QRCODE_OUTPUT_DEST
  WEAPP_CI_SOURCE_MAP_SAVE_PATH
  WEAPP_CI_SKIP_BUILD=1
`.trim()

/**
 * @description 解析简单命令行参数，保持脚本依赖面尽量小。
 */
function parseFlags(argv: string[]) {
  const positional: string[] = []
  const flags: CliFlagMap = {}

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token) {
      continue
    }

    if (!token.startsWith('--')) {
      positional.push(token)
      continue
    }

    const [rawKey, inlineValue] = token.slice(2).split('=', 2)
    const key = rawKey.trim()
    if (!key) {
      continue
    }

    if (inlineValue !== undefined) {
      flags[key] = inlineValue
      continue
    }

    const next = argv[index + 1]
    if (!next || next.startsWith('--')) {
      flags[key] = true
      continue
    }

    flags[key] = next
    index += 1
  }

  return { positional, flags }
}

/**
 * @description 读取字符串参数，优先命令行，其次环境变量。
 */
function readStringFlag(flags: CliFlagMap, key: string, envName?: string) {
  const cliValue = flags[key]
  if (typeof cliValue === 'string' && cliValue.trim()) {
    return cliValue.trim()
  }

  const envValue = envName ? process.env[envName]?.trim() : undefined
  return envValue || undefined
}

/**
 * @description 解析布尔开关，兼容 `1/true` 的环境变量写法。
 */
function readBooleanFlag(flags: CliFlagMap, key: string, envName?: string) {
  if (flags[key] === true) {
    return true
  }

  const envValue = envName ? process.env[envName]?.trim().toLowerCase() : ''
  return envValue === '1' || envValue === 'true'
}

/**
 * @description 解析数字参数，并在非法输入时尽早失败。
 */
function readNumberFlag(flags: CliFlagMap, key: string, envName?: string) {
  const value = readStringFlag(flags, key, envName)
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`参数 ${key} 需要是数字，当前值为 ${value}`)
  }
  return parsed
}

/**
 * @description 将 project.config.json 中的 compileType 映射到 miniprogram-ci 所需类型。
 */
function resolveProjectType(compileType?: string): ResolvedOptions['projectType'] {
  if (compileType === 'plugin') {
    return 'plugin'
  }
  if (compileType === 'minigame') {
    return 'miniGame'
  }
  return 'miniProgram'
}

/**
 * @description 当项目未显式提供 version 时，退回到时间戳版本，避免 upload 缺参。
 */
function createFallbackVersion() {
  const now = new Date()
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')
  const timePart = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('')
  return `0.0.0-${datePart}${timePart}`
}

/**
 * @description 读取 JSON 文件；这里的项目配置是标准 JSON，无需额外解析器。
 */
async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf8')
  return JSON.parse(content) as T
}

/**
 * @description 解析命令行与项目配置，得到完整的 CI 运行参数。
 */
async function resolveOptions(argv: string[]): Promise<ResolvedOptions> {
  const { positional, flags } = parseFlags(argv)
  if (flags.help || positional[0] === 'help') {
    console.log(HELP_TEXT)
    process.exit(0)
  }

  const action = positional[0]
  if (action !== 'preview' && action !== 'upload') {
    throw new Error(`缺少合法动作，当前收到 ${String(action)}，仅支持 preview 或 upload`)
  }

  const project = readStringFlag(flags, 'project', 'WEAPP_CI_PROJECT')
  if (!project) {
    throw new Error('缺少 --project，或未设置 WEAPP_CI_PROJECT')
  }

  const projectRoot = path.resolve(process.cwd(), project)
  await loadLocalEnvFiles(projectRoot)
  const projectConfigPath = path.join(projectRoot, 'project.config.json')
  const packageJsonPath = path.join(projectRoot, 'package.json')
  await fs.access(projectRoot)
  const [projectConfig, packageJson] = await Promise.all([
    readJsonFile<ProjectConfig>(projectConfigPath),
    readJsonFile<{ version?: string }>(packageJsonPath),
  ])

  const privateKeyPath = readStringFlag(flags, 'private-key', 'WEAPP_CI_PRIVATE_KEY_PATH')
  if (!privateKeyPath) {
    throw new Error('缺少 --private-key，或未设置 WEAPP_CI_PRIVATE_KEY_PATH')
  }

  const appid = readStringFlag(flags, 'appid', 'WEAPP_CI_APPID') ?? projectConfig.appid
  if (!appid || appid === 'touristappid') {
    throw new Error('未拿到合法 appid，请通过 project.config.json 或 --appid / WEAPP_CI_APPID 提供真实 AppID')
  }

  const robot = readNumberFlag(flags, 'robot', 'WEAPP_CI_ROBOT') ?? 1
  if (robot < 1 || robot > 30) {
    throw new Error(`robot 必须在 1 到 30 之间，当前值为 ${robot}`)
  }

  const version = readStringFlag(flags, 'version', 'WEAPP_CI_VERSION')
    ?? packageJson.version
    ?? createFallbackVersion()
  const desc = readStringFlag(flags, 'desc', 'WEAPP_CI_DESC')
    ?? `${action} via miniprogram-ci`
  const qrcodeFormat = (readStringFlag(flags, 'qrcode-format', 'WEAPP_CI_QRCODE_FORMAT')
    ?? 'image') as ResolvedOptions['qrcodeFormat']
  if (!QRCODE_FORMATS.has(qrcodeFormat)) {
    throw new Error(`不支持的 qrcode format: ${qrcodeFormat}，仅支持 terminal、image、base64`)
  }
  const qrcodeOutputDest = readStringFlag(flags, 'qrcode-output', 'WEAPP_CI_QRCODE_OUTPUT_DEST')
    ?? (qrcodeFormat === 'image'
      ? path.join(process.cwd(), '.tmp', 'miniprogram-ci', path.basename(projectRoot), 'preview.jpg')
      : undefined)
  const resolvedPrivateKeyPath = path.resolve(process.cwd(), privateKeyPath)
  await fs.access(resolvedPrivateKeyPath)

  return {
    action,
    project,
    projectRoot,
    privateKeyPath: resolvedPrivateKeyPath,
    appid,
    robot,
    version,
    desc,
    pagePath: readStringFlag(flags, 'page', 'WEAPP_CI_PAGE_PATH'),
    searchQuery: readStringFlag(flags, 'query', 'WEAPP_CI_SEARCH_QUERY'),
    scene: readNumberFlag(flags, 'scene', 'WEAPP_CI_SCENE'),
    qrcodeFormat,
    qrcodeOutputDest,
    sourceMapSavePath: readStringFlag(flags, 'source-map-save-path', 'WEAPP_CI_SOURCE_MAP_SAVE_PATH'),
    skipBuild: readBooleanFlag(flags, 'skip-build', 'WEAPP_CI_SKIP_BUILD'),
    projectType: resolveProjectType(projectConfig.compileType),
  }
}

/**
 * @description 在预览/上传前先执行目标项目构建，保证上传的是最新 dist。
 */
async function runBuild(options: ResolvedOptions) {
  if (options.skipBuild) {
    return
  }

  const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  await new Promise<void>((resolve, reject) => {
    const child = spawn(pnpmCommand, ['--dir', options.projectRoot, 'run', 'build'], {
      stdio: 'inherit',
      shell: false,
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`目标项目构建失败，退出码 ${code ?? 'unknown'}`))
    })
  })
}

/**
 * @description 统一打印当前任务的关键上下文，方便 CI 日志排查。
 */
function printSummary(options: ResolvedOptions) {
  console.log(`[miniprogram-ci] action=${options.action}`)
  console.log(`[miniprogram-ci] project=${options.project}`)
  console.log(`[miniprogram-ci] appid=${options.appid}`)
  console.log(`[miniprogram-ci] robot=${options.robot}`)
  console.log(`[miniprogram-ci] version=${options.version}`)
  console.log(`[miniprogram-ci] build=${options.skipBuild ? 'skip' : 'run'}`)
}

/**
 * @description 确认隔离 runner 已安装完成，避免在主工作区解析 miniprogram-ci。
 */
async function ensureIsolatedRunnerInstalled() {
  await fs.access(ISOLATED_RUNNER_ENTRY)
  try {
    await fs.access(ISOLATED_RUNNER_NODE_MODULES)
  }
  catch {
    throw new Error('隔离 runner 尚未安装依赖，请先执行 pnpm weapp:ci:setup')
  }
}

/**
 * @description 执行隔离目录下的 miniprogram-ci runner，避免污染主工作区依赖解析。
 */
async function runCi(options: ResolvedOptions) {
  await ensureIsolatedRunnerInstalled()

  const runnerArgs = [
    ISOLATED_RUNNER_ENTRY,
    options.action,
    '--project-root',
    options.projectRoot,
    '--private-key',
    options.privateKeyPath,
    '--appid',
    options.appid,
    '--robot',
    String(options.robot),
    '--ci-version',
    options.version,
    '--desc',
    options.desc,
    '--project-type',
    options.projectType,
    '--qrcode-format',
    options.qrcodeFormat,
  ]

  if (options.pagePath) {
    runnerArgs.push('--page', options.pagePath)
  }
  if (options.searchQuery) {
    runnerArgs.push('--query', options.searchQuery)
  }
  if (options.scene !== undefined) {
    runnerArgs.push('--scene', String(options.scene))
  }
  if (options.qrcodeOutputDest) {
    runnerArgs.push('--qrcode-output', options.qrcodeOutputDest)
  }
  if (options.sourceMapSavePath) {
    runnerArgs.push('--source-map-save-path', options.sourceMapSavePath)
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, runnerArgs, {
      cwd: ISOLATED_RUNNER_DIR,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS: '',
      },
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`isolated miniprogram-ci runner 执行失败，退出码 ${code ?? 'unknown'}`))
    })
  })
}

async function main() {
  const options = await resolveOptions(process.argv.slice(2))
  printSummary(options)
  await runBuild(options)
  await runCi(options)
}

main().catch((error) => {
  console.error(`[miniprogram-ci] ${(error as Error).message}`)
  process.exitCode = 1
})
