/**
 * @file 二维码与插件路径工具。
 */
import process from 'node:process'
import { decodeQrCodeFromBase64, renderTerminalQrCode } from '@weapp-vite/qr'
import { startWith } from './internal/compat'

const regPluginId = /^(?:plugin-private:\/\/|__plugin__\/)([0-9a-zA-Z]+)\//
/** decodeQrCode 的方法封装。 */
export function decodeQrCode(qrCode: string) {
  return decodeQrCodeFromBase64(qrCode)
}
/** printQrCode 的方法封装。 */
export function printQrCode(content: string) {
  return new Promise<void>((resolve) => {
    process.stdout.write(renderTerminalQrCode(content, { small: true }))
    resolve()
  })
}
/** isPluginPath 的方法封装。 */
export function isPluginPath(p: unknown) {
  if (typeof p !== 'string') {
    return false
  }
  return startWith(p, 'plugin-private://') || startWith(p, '__plugin__/')
}
/** extractPluginId 的方法封装。 */
export function extractPluginId(p: unknown) {
  if (typeof p !== 'string') {
    return ''
  }
  const match = p.match(regPluginId)
  return match ? match[1] : ''
}
