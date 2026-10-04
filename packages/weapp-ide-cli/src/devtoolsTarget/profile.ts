import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

export interface WechatDevtoolsProfileOptions {
  homeDir?: string
  localAppDataDir?: string
  platform?: NodeJS.Platform
}

/** 按所选宿主的存储布局定位配置，不扫描其他安装的目录。 */
export function resolveWechatDevtoolsProfileDir(appPath: string, options: WechatDevtoolsProfileOptions = {}) {
  const platform = options.platform ?? process.platform
  const homeDir = options.homeDir ?? os.homedir()
  const baseDir = platform === 'darwin'
    ? path.join(homeDir, 'Library', 'Application Support', '微信开发者工具')
    : platform === 'win32'
      ? path.join(options.localAppDataDir ?? process.env.LOCALAPPDATA ?? path.join(homeDir, 'AppData', 'Local'), '微信开发者工具', 'User Data')
      : path.join(process.env.XDG_CONFIG_HOME ?? path.join(homeDir, '.config'), '微信开发者工具')
  // 旧 Windows NW.js 安装沿用 User Data 根；Electron 和 macOS 按应用路径区分配置。
  if (platform === 'win32' && path.basename(appPath) === 'package.nw') {
    return baseDir
  }
  return path.join(baseDir, createHash('md5').update(appPath).digest('hex'))
}
