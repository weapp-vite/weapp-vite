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

export interface BootstrapWechatDevtoolsSettingsOptions {
  homeDir?: string
  localAppDataDir?: string
  platform?: NodeJS.Platform
  projectPath?: string
  trustProject?: boolean
}

export interface BootstrapWechatDevtoolsSettingsResult {
  touchedInstanceCount: number
  updatedSecurityCount: number
  trustedProjectCount: number
}

const DEFAULT_WECHAT_DEVTOOLS_SECURITY_SETTINGS: WechatDevtoolsSecuritySettings = {
  enableServicePort: true,
  port: 21992,
  allowGetTicket: true,
  trustWhenAuto: true,
}

const WECHAT_DEVTOOLS_SETTINGS_KEY = 'reduxPersist:settings'

function resolveWechatDevtoolsBaseDir(
  homeDir: string,
  platform: NodeJS.Platform,
  localAppDataDir?: string,
) {
  if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', '微信开发者工具')
  }

  if (platform === 'win32') {
    return path.join(localAppDataDir ?? path.join(homeDir, 'AppData', 'Local'), '微信开发者工具', 'User Data')
  }

  return undefined
}

function createStorageHash(key: string) {
  return createHash('md5').update(key).digest('hex')
}

async function readJsonObject(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    return parsed as Record<string, unknown>
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

async function updateWechatDevtoolsSecuritySettings(localDataDir: string) {
  const settingsHash = await syncHashKeyMap(localDataDir, WECHAT_DEVTOOLS_SETTINGS_KEY)
  const fileNames = [
    `localstorage_${settingsHash}.json`,
    `ls_${settingsHash}.json`,
  ]

  for (const fileName of fileNames) {
    const filePath = path.join(localDataDir, fileName)
    const current = await readJsonObject(filePath)
    const security = current.security && typeof current.security === 'object' && !Array.isArray(current.security)
      ? current.security as Record<string, unknown>
      : {}

    await writeJsonObject(filePath, {
      ...current,
      security: {
        ...security,
        ...DEFAULT_WECHAT_DEVTOOLS_SECURITY_SETTINGS,
      },
    })
  }
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

/**
 * @description 在微信开发者工具启动前，预写入服务端口与项目信任配置。
 */
export async function bootstrapWechatDevtoolsSettings(
  options: BootstrapWechatDevtoolsSettingsOptions = {},
): Promise<BootstrapWechatDevtoolsSettingsResult> {
  const platform = options.platform ?? process.platform
  const homeDir = options.homeDir ?? process.env.USERPROFILE ?? process.env.HOME ?? os.homedir()
  if (!homeDir) {
    return {
      touchedInstanceCount: 0,
      updatedSecurityCount: 0,
      trustedProjectCount: 0,
    }
  }

  const localAppDataDir = options.localAppDataDir ?? process.env.LOCALAPPDATA ?? path.join(homeDir, 'AppData', 'Local')
  const baseDir = resolveWechatDevtoolsBaseDir(homeDir, platform, localAppDataDir)
  if (!baseDir) {
    return {
      touchedInstanceCount: 0,
      updatedSecurityCount: 0,
      trustedProjectCount: 0,
    }
  }

  const instanceDirs = await resolveWechatDevtoolsInstanceDirs(baseDir)
  let updatedSecurityCount = 0
  let trustedProjectCount = 0

  for (const instanceDir of instanceDirs) {
    const localDataDir = path.join(instanceDir, 'WeappLocalData')
    await updateWechatDevtoolsSecuritySettings(localDataDir)
    updatedSecurityCount += 1

    if (options.projectPath && options.trustProject !== false) {
      await trustWechatDevtoolsProject(localDataDir, options.projectPath)
      trustedProjectCount += 1
    }
  }

  return {
    touchedInstanceCount: instanceDirs.length,
    updatedSecurityCount,
    trustedProjectCount,
  }
}
