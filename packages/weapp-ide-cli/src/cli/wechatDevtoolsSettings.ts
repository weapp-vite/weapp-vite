import type { ResolvedWechatDevtoolsTarget, ResolveWechatDevtoolsTargetOptions } from '../devtoolsTarget'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { resolveWechatDevtoolsTarget } from '../devtoolsTarget'

export interface WechatDevtoolsSecuritySettings {
  enableServicePort: boolean
  port: number
  allowGetTicket: boolean
  trustWhenAuto: boolean
}

export interface DetectedWechatDevtoolsServicePortSettings {
  enabled?: boolean
  port?: number
}

export interface DetectWechatDevtoolsServicePortOptions extends ResolveWechatDevtoolsTargetOptions {
  target?: ResolvedWechatDevtoolsTarget
}

export interface DetectWechatDevtoolsServicePortResult {
  touchedInstanceCount: number
  detectedSecurityCount: number
  servicePort?: number
  servicePortEnabled?: boolean
}

export interface BootstrapWechatDevtoolsSettingsOptions extends DetectWechatDevtoolsServicePortOptions {
  projectPath?: string
  trustProject?: boolean
}

export interface BootstrapWechatDevtoolsSettingsResult extends DetectWechatDevtoolsServicePortResult {
  updatedSecurityCount: number
  trustedProjectCount: number
}

interface PartialWechatDevtoolsSecuritySettings {
  enableServicePort?: boolean
  port?: number
  allowGetTicket?: boolean
  trustWhenAuto?: boolean
}

function createStorageHash(key: string) {
  return createHash('md5').update(key).digest('hex')
}

const WECHAT_DEVTOOLS_SETTINGS_KEY = 'reduxPersist:settings'
const SETTINGS_STORAGE_HASH = createStorageHash(WECHAT_DEVTOOLS_SETTINGS_KEY)
const SETTINGS_STORAGE_FILE_NAMES = [
  `localstorage_${SETTINGS_STORAGE_HASH}.json`,
  `ls_${SETTINGS_STORAGE_HASH}.json`,
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizePort(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return undefined
  }

  if (value <= 0 || value > 65535) {
    return undefined
  }

  return value
}

function normalizeWechatDevtoolsSecuritySettings(value: unknown) {
  if (!isRecord(value)) {
    return undefined
  }

  const normalized: PartialWechatDevtoolsSecuritySettings = {}

  if (typeof value.enableServicePort === 'boolean') {
    normalized.enableServicePort = value.enableServicePort
  }

  const port = normalizePort(value.port)
  if (port !== undefined) {
    normalized.port = port
  }

  if (typeof value.allowGetTicket === 'boolean') {
    normalized.allowGetTicket = value.allowGetTicket
  }

  if (typeof value.trustWhenAuto === 'boolean') {
    normalized.trustWhenAuto = value.trustWhenAuto
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined
}

async function resolveSelectedProfile(options: DetectWechatDevtoolsServicePortOptions) {
  const platform = options.platform ?? process.platform
  if (!options.target && platform !== 'darwin' && platform !== 'win32') {
    return undefined
  }
  return (await resolveWechatDevtoolsTarget(options)).profileDir
}

async function readJsonObject(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) {
      return {}
    }
    return parsed
  }
  catch (error) {
    const typedError = error as NodeJS.ErrnoException
    if (typedError.code === 'ENOENT') {
      return {}
    }
    if (error instanceof SyntaxError) {
      return {}
    }
    throw error
  }
}

async function writeJsonObject(filePath: string, value: Record<string, unknown>) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function detectWechatDevtoolsSecuritySettings(localDataDir: string) {
  for (const fileName of SETTINGS_STORAGE_FILE_NAMES) {
    const filePath = path.join(localDataDir, fileName)
    const current = await readJsonObject(filePath)
    const security = normalizeWechatDevtoolsSecuritySettings(current.security)
    if (security) {
      return security
    }
  }

  return undefined
}

async function trustWechatDevtoolsProject(localDataDir: string, projectPath: string) {
  const normalizedProjectPath = path.resolve(projectPath)
  const projectKey = `project2_${normalizedProjectPath}`
  const projectHash = createStorageHash(projectKey)
  const fileNames = [
    `localstorage_${projectHash}.json`,
    `ls_${projectHash}.json`,
  ]

  let trusted = false
  for (const fileName of fileNames) {
    const projectFilePath = path.join(localDataDir, fileName)
    const current = await readJsonObject(projectFilePath)

    // 首次导入必须由 IDE 初始化完整能力；预建信任记录会令 attr.setting 缺失。
    if (current.projectid !== normalizedProjectPath
      || current.projectpath !== normalizedProjectPath
      || typeof current.appid !== 'string'
      || !current.appid
      || !isRecord(current.attr)
      || !isRecord(current.attr.setting)) {
      continue
    }

    await writeJsonObject(projectFilePath, {
      ...current,
      isTrusted: true,
    })
    trusted = true
  }
  return trusted
}

async function scanWechatDevtoolsServicePort(profileDir: string | undefined): Promise<DetectWechatDevtoolsServicePortResult> {
  const localDataDir = profileDir && path.join(profileDir, 'WeappLocalData')
  const exists = localDataDir && await fs.stat(localDataDir).then(stat => stat.isDirectory(), (error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') {
      throw error
    }
    return false
  })
  const security = exists && localDataDir ? await detectWechatDevtoolsSecuritySettings(localDataDir) : undefined
  return {
    touchedInstanceCount: exists ? 1 : 0,
    detectedSecurityCount: security ? 1 : 0,
    servicePort: security?.port,
    servicePortEnabled: security?.enableServicePort,
  }
}

/**
 * @description 检测微信开发者工具当前服务端口配置，严格沿用用户已有设置。
 */
export async function detectWechatDevtoolsServicePort(
  options: DetectWechatDevtoolsServicePortOptions = {},
): Promise<DetectWechatDevtoolsServicePortResult> {
  return await scanWechatDevtoolsServicePort(await resolveSelectedProfile(options))
}

/**
 * @description 在启动微信开发者工具前，检测服务端口配置，并按需写入项目信任信息。
 */
export async function bootstrapWechatDevtoolsSettings(
  options: BootstrapWechatDevtoolsSettingsOptions = {},
): Promise<BootstrapWechatDevtoolsSettingsResult> {
  const profileDir = await resolveSelectedProfile(options)
  const result = await scanWechatDevtoolsServicePort(profileDir)
  const trusted = profileDir && result.touchedInstanceCount && options.projectPath && options.trustProject === true
    ? await trustWechatDevtoolsProject(path.join(profileDir, 'WeappLocalData'), options.projectPath)
    : false
  return {
    ...result,
    updatedSecurityCount: 0,
    trustedProjectCount: trusted ? 1 : 0,
  }
}
