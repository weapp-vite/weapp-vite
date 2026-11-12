import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { colors } from './logger'

/** 保留路径显示文字，通过终端超链接关联文件地址，机器输出不附加控制序列。 */
export function formatTerminalPath(value: string): string {
  if (!process.stderr.isTTY || process.env.CI || process.env.TERM === 'dumb') {
    return value
  }
  const target = pathToFileURL(path.resolve(value)).href
  return `\u001B]8;;${target}\u001B\\${colors.green(value)}\u001B]8;;\u001B\\`
}
