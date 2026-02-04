import os from 'node:os'
import process from 'node:process'
import fs from 'fs-extra'
import path from 'pathe'
import logger from '../logger'

/**
 * @description 官方微信开发者工具只支持 Windows、macOS，Linux 只有社区版
 * https://github.com/msojocs/wechat-web-devtools-linux
 */
export const SupportedPlatformsMap = {
  Windows_NT: 'Windows_NT',
  Darwin: 'Darwin',
  Linux: 'Linux',
} as const

/**
 * @description 支持的系统类型
 */
export type SupportedPlatform = (typeof SupportedPlatformsMap)[keyof typeof SupportedPlatformsMap]

/**
 * @description 判断当前系统是否支持微信开发者工具
 */
export function isOperatingSystemSupported(osName: string = os.type()): osName is SupportedPlatform {
  return osName === SupportedPlatformsMap.Windows_NT
    || osName === SupportedPlatformsMap.Darwin
    || osName === SupportedPlatformsMap.Linux
}

/**
 * @description 当前系统名称
 */
export const operatingSystemName = os.type()

type CliPathResolver = () => Promise<string | undefined>

function createLinuxCliResolver(): CliPathResolver {
  let resolvedPath: string | undefined
  let attempted = false
  let pending: Promise<string | undefined> | null = null

  return async () => {
    if (attempted) {
      return resolvedPath
    }

    if (!pending) {
      pending = (async () => {
        try {
          const envPath = await getFirstBinaryPath('wechat-devtools-cli')
          if (envPath) {
            resolvedPath = envPath
          }
        }
        catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          logger.warn(`获取 Linux wechat-devtools-cli 路径失败：${reason}`)
        }
        finally {
          attempted = true
        }

        return resolvedPath
      })()
    }

    return pending
  }
}

const linuxCliResolver = createLinuxCliResolver()

const WINDOWS_DEFAULT_CLI
  = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat'
const DARWIN_DEFAULT_CLI = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'

const cliPathResolvers: Record<SupportedPlatform, CliPathResolver> = {
  [SupportedPlatformsMap.Windows_NT]: async () => WINDOWS_DEFAULT_CLI,
  [SupportedPlatformsMap.Darwin]: async () => DARWIN_DEFAULT_CLI,
  [SupportedPlatformsMap.Linux]: linuxCliResolver,
}

/**
 * @description 获取默认 CLI 路径（按系统）
 */
export async function getDefaultCliPath(targetOs: string = operatingSystemName) {
  if (!isOperatingSystemSupported(targetOs)) {
    return undefined
  }

  const resolver = cliPathResolvers[targetOs]
  const resolvedPath = await resolver()
  return resolvedPath
}

async function getFirstBinaryPath(command: string): Promise<string | undefined> {
  const envPath = process.env.PATH || ''
  const pathDirs = envPath.split(path.delimiter)

  for (const dir of pathDirs) {
    const fullPath = path.join(dir, command)
    try {
      await fs.access(fullPath, fs.constants.X_OK)
      return fullPath
    }
    catch {
      continue
    }
  }

  return undefined
}
