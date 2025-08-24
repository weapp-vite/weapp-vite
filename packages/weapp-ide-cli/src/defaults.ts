import * as fs from 'node:fs/promises'
import os from 'node:os'
import process from 'node:process'
import path from 'pathe'
import logger from './logger'

const homedir = os.homedir()

/**
 * 官方微信开发者工具只支持 Windows、macOS, Linux只有社区版 https://github.com/msojocs/wechat-web-devtools-linux
 */
const SupportedPlatformsMap = {
  Windows_NT: 'Windows_NT',
  Darwin: 'Darwin',
  Linux: 'Linux',
}

/**
 * 通过检查标准系统路径获取命令的路径
 * @param command 要查询的命令（如 'ls'、'firefox'）
 * @returns 第一个找到的二进制路径，未找到则返回undefined
 */
async function getFirstBinaryPath(command: string): Promise<string | undefined> {
  // 如果未找到，尝试使用PATH环境变量（可选）
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

  return undefined // 未找到任何有效路径
}

export const operatingSystemName = os.type()

// 同步初始化默认路径映射
const defaultPathMap = {
  [SupportedPlatformsMap.Windows_NT]:
    'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat',
  [SupportedPlatformsMap.Darwin]:
    '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
} as Record<string, string>

// 异步初始化函数
let linuxPathInitialized = false
// 异步获取Linux开发工具路径的函数
async function getLinuxDevToolsPath() {
  if (operatingSystemName !== 'Linux' && linuxPathInitialized) {
    return
  }
  try {
    const linuxDevCliPath = await getFirstBinaryPath('wechat-devtools-cli')
    if (linuxDevCliPath) {
      linuxPathInitialized = true
      defaultPathMap[SupportedPlatformsMap.Linux] = linuxDevCliPath
    }
  }
  catch (error) {
    if (error instanceof Error) {
      logger.error('获取Linux开发工具 wechat-devtools-cli 路径失败:', error.message)
    }
    else {
      logger.error('获取Linux开发工具 wechat-devtools-cli 路径失败:', error)
    }
    return defaultPathMap[SupportedPlatformsMap.Linux]
  }
}

// 导出默认路径（异步获取）
export async function getDefaultPath() {
  await getLinuxDevToolsPath()
  return defaultPathMap[operatingSystemName]
}

export const defaultCustomConfigDirPath = path.join(homedir, '.weapp-ide-cli')
export const defaultCustomConfigFilePath = path.join(
  defaultCustomConfigDirPath,
  'config.json',
)
