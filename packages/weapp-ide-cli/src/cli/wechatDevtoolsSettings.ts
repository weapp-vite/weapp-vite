import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

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

export interface DetectWechatDevtoolsServicePortOptions {
  homeDir?: string
  localAppDataDir?: string
  platform?: NodeJS.Platform
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

interface ResolvedWechatDevtoolsContext {
  baseDir: string
  homeDir: string
  localAppDataDir: string
  platform: NodeJS.Platform
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

function resolveWechatDevtoolsBaseDir(
  homeDir: string,
  platform: NodeJS.Platform,
  localAppDataDir: string,
) {
  if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', '微信开发者工具')
  }

  if (platform === 'win32') {
    return path.join(localAppDataDir, '微信开发者工具', 'User Data')
  }

  return undefined
}

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

function shouldPreferServicePortCandidate(
  current: DetectedWechatDevtoolsServicePortSettings,
  next: DetectedWechatDevtoolsServicePortSettings,
) {
  if (current.enabled === undefined && current.port === undefined) {
    return true
  }

  if (next.enabled === true && current.enabled !== true) {
    return true
  }

  if (next.enabled === current.enabled && next.port !== undefined && current.port === undefined) {
    return true
  }

  return false
}

function createResolvedWechatDevtoolsContext(
  options: DetectWechatDevtoolsServicePortOptions = {},
): ResolvedWechatDevtoolsContext | undefined {
  const platform = options.platform ?? process.platform
  const homeDir = options.homeDir ?? process.env.USERPROFILE ?? process.env.HOME ?? os.homedir()
  if (!homeDir) {
    return undefined
  }

  const localAppDataDir = options.localAppDataDir
    ?? process.env.LOCALAPPDATA
    ?? path.join(homeDir, 'AppData', 'Local')
  const baseDir = resolveWechatDevtoolsBaseDir(homeDir, platform, localAppDataDir)
  if (!baseDir) {
    return undefined
  }

  return {
    baseDir,
    homeDir,
    localAppDataDir,
    platform,
  }
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

async function resolveWechatDevtoolsInstanceDirs(baseDir: string) {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true })
    const instanceDirs: string[] = []
    const seenDirs = new Set<string>()

    const appendInstanceDir = async (instanceDir: string) => {
      if (seenDirs.has(instanceDir)) {
        return
      }

      try {
        const stats = await fs.stat(path.join(instanceDir, 'WeappLocalData'))
        if (stats.isDirectory()) {
          instanceDirs.push(instanceDir)
          seenDirs.add(instanceDir)
        }
      }
      catch {
      }
    }

    await appendInstanceDir(baseDir)

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }

      await appendInstanceDir(path.join(baseDir, entry.name))
    }

    return instanceDirs
  }
  catch (error) {
    const typedError = error as NodeJS.ErrnoException
    if (typedError.code === 'ENOENT') {
      return []
    }
    throw error
  }
}

async function syncHashKeyMap(localDataDir: string, key: string) {
  const hash = createStorageHash(key)
  const hashKeyMapPath = path.join(localDataDir, 'hash_key_map_2.json')
  const current = await readJsonObject(hashKeyMapPath)

  if (current[hash] !== key) {
    current[hash] = key
    await writeJsonObject(hashKeyMapPath, current)
  }

  return hash
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
  const projectHash = await syncHashKeyMap(localDataDir, projectKey)
  const fileNames = [
    `localstorage_${projectHash}.json`,
    `ls_${projectHash}.json`,
  ]

  for (const fileName of fileNames) {
    const projectFilePath = path.join(localDataDir, fileName)
    const current = await readJsonObject(projectFilePath)

    await writeJsonObject(projectFilePath, {
      ...current,
      projectid: typeof current.projectid === 'string' && current.projectid.length > 0
        ? current.projectid
        : normalizedProjectPath,
      projectpath: typeof current.projectpath === 'string' && current.projectpath.length > 0
        ? current.projectpath
        : normalizedProjectPath,
      isTrusted: true,
    })
  }
}

async function scanWechatDevtoolsServicePort(
  context: ResolvedWechatDevtoolsContext,
): Promise<DetectWechatDevtoolsServicePortResult & { instanceDirs: string[] }> {
  const instanceDirs = await resolveWechatDevtoolsInstanceDirs(context.baseDir)
  let detectedSecurityCount = 0
  let detectedServicePort: DetectedWechatDevtoolsServicePortSettings = {}

  for (const instanceDir of instanceDirs) {
    const localDataDir = path.join(instanceDir, 'WeappLocalData')
    const security = await detectWechatDevtoolsSecuritySettings(localDataDir)
    if (!security) {
      continue
    }

    detectedSecurityCount += 1

    const candidate: DetectedWechatDevtoolsServicePortSettings = {
      enabled: security.enableServicePort,
      port: security.port,
    }
    if (shouldPreferServicePortCandidate(detectedServicePort, candidate)) {
      detectedServicePort = candidate
    }
  }

  return {
    instanceDirs,
    touchedInstanceCount: instanceDirs.length,
    detectedSecurityCount,
    servicePort: detectedServicePort.port,
    servicePortEnabled: detectedServicePort.enabled,
  }
}

/**
 * @description 检测微信开发者工具当前服务端口配置，严格沿用用户已有设置。
 */
export async function detectWechatDevtoolsServicePort(
  options: DetectWechatDevtoolsServicePortOptions = {},
): Promise<DetectWechatDevtoolsServicePortResult> {
  const context = createResolvedWechatDevtoolsContext(options)
  if (!context) {
    return {
      touchedInstanceCount: 0,
      detectedSecurityCount: 0,
      servicePort: undefined,
      servicePortEnabled: undefined,
    }
  }

  const result = await scanWechatDevtoolsServicePort(context)
  return {
    touchedInstanceCount: result.touchedInstanceCount,
    detectedSecurityCount: result.detectedSecurityCount,
    servicePort: result.servicePort,
    servicePortEnabled: result.servicePortEnabled,
  }
}

/**
 * @description 在启动微信开发者工具前，检测服务端口配置，并按需写入项目信任信息。
 */
export async function bootstrapWechatDevtoolsSettings(
  options: BootstrapWechatDevtoolsSettingsOptions = {},
): Promise<BootstrapWechatDevtoolsSettingsResult> {
  const context = createResolvedWechatDevtoolsContext(options)
  if (!context) {
    return {
      touchedInstanceCount: 0,
      detectedSecurityCount: 0,
      updatedSecurityCount: 0,
      trustedProjectCount: 0,
      servicePort: undefined,
      servicePortEnabled: undefined,
    }
  }

  const scanResult = await scanWechatDevtoolsServicePort(context)
  let trustedProjectCount = 0

  for (const instanceDir of scanResult.instanceDirs) {
    const localDataDir = path.join(instanceDir, 'WeappLocalData')

    if (options.projectPath && options.trustProject !== false) {
      await trustWechatDevtoolsProject(localDataDir, options.projectPath)
      trustedProjectCount += 1
    }
  }

  return {
    touchedInstanceCount: scanResult.touchedInstanceCount,
    detectedSecurityCount: scanResult.detectedSecurityCount,
    updatedSecurityCount: 0,
    trustedProjectCount,
    servicePort: scanResult.servicePort,
    servicePortEnabled: scanResult.servicePortEnabled,
  }
}
