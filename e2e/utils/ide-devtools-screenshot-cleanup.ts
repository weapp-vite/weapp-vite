import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const SCREENSHOT_ARTIFACT_PATTERN = /^[\w-]{12}[a-f\d]{32}\.png$/i
const DEVTOOLS_BACKUP_PROFILE_PATTERN = /\.backup-/i

interface CleanupDevtoolsScreenshotArtifactsOptions {
  appDataDir?: string
  homeDir?: string
  platform?: NodeJS.Platform
  rootDirs?: string[]
}

export interface DevtoolsScreenshotCleanupResult {
  bytes: number
  files: number
}

function resolveDevtoolsDataRoots(
  options: CleanupDevtoolsScreenshotArtifactsOptions,
) {
  if (options.rootDirs) {
    return options.rootDirs
  }
  const platform = options.platform ?? process.platform
  if (platform === 'darwin') {
    return [path.join(
      options.homeDir ?? os.homedir(),
      'Library/Application Support/微信开发者工具',
    )]
  }
  if (platform === 'win32' && options.appDataDir) {
    return [
      path.join(options.appDataDir, '微信开发者工具'),
      path.join(options.appDataDir, 'Tencent/微信开发者工具'),
    ]
  }
  return []
}

async function readDirectories(root: string) {
  return (await fs.readdir(root, { withFileTypes: true }).catch(() => []))
    .filter(entry => entry.isDirectory())
}

async function resolveScreenshotTempDirs(dataRoot: string) {
  const tempDirs: string[] = []
  for (const profile of await readDirectories(dataRoot)) {
    if (DEVTOOLS_BACKUP_PROFILE_PATTERN.test(profile.name)) {
      continue
    }
    const fileSystemRoot = path.join(
      dataRoot,
      profile.name,
      'WeappSimulator/WeappFileSystem',
    )
    for (const account of await readDirectories(fileSystemRoot)) {
      const accountRoot = path.join(fileSystemRoot, account.name)
      for (const app of await readDirectories(accountRoot)) {
        tempDirs.push(path.join(accountRoot, app.name, 'tmp'))
      }
    }
  }
  return tempDirs
}

/** 清理 DevTools 截图协议遗留在小程序 tmp 目录中的 PNG，避免长套件触发 100 文件上限。 */
export async function cleanupDevtoolsScreenshotArtifacts(
  options: CleanupDevtoolsScreenshotArtifactsOptions = {},
): Promise<DevtoolsScreenshotCleanupResult> {
  const result: DevtoolsScreenshotCleanupResult = { bytes: 0, files: 0 }
  for (const dataRoot of resolveDevtoolsDataRoots(options)) {
    for (const tempDir of await resolveScreenshotTempDirs(dataRoot)) {
      const entries = await fs.readdir(tempDir, { withFileTypes: true }).catch(() => [])
      for (const entry of entries) {
        if (!entry.isFile() || !SCREENSHOT_ARTIFACT_PATTERN.test(entry.name)) {
          continue
        }
        const artifactPath = path.join(tempDir, entry.name)
        const stats = await fs.stat(artifactPath).catch(() => undefined)
        await fs.rm(artifactPath, { force: true }).catch(() => {})
        result.files += 1
        result.bytes += stats?.size ?? 0
      }
    }
  }
  return result
}
