import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { colors } from './logger'

/** 将诊断路径展示为终端可识别的文件 URL，机器输出保留原始路径。 */
export function formatTerminalPath(value: string): string {
  if (!process.stderr.isTTY || process.env.CI || process.env.TERM === 'dumb') {
    return value
  }
  return colors.green(pathToFileURL(path.resolve(value)).href)
}
