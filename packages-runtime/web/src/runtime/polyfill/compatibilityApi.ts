import type { KeyboardHeightChangeCallback, MemoryWarningCallback, SetEnableDebugOptions, SetKeepScreenOnOptions } from './types/compatibility'
import { emitRuntimeWarning } from '../warning'
import { callMiniProgramAsyncSuccess } from './async'

export type { KeyboardHeightChangeCallback, MemoryWarningCallback, SetEnableDebugOptions, SetKeepScreenOnOptions } from './types/compatibility'

/** Web 预览只兼容调用形态，不更改浏览器的屏幕唤醒策略。 */
export function setKeepScreenOn(options: SetKeepScreenOnOptions) {
  emitRuntimeWarning('[@weapp-vite/web] wx.setKeepScreenOn 在 Web 端仅兼容调用，不会阻止设备息屏。', { key: 'setKeepScreenOn' })
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'setKeepScreenOn:ok' }))
}

/** Web 调试由浏览器控制，不修改共享的日志或开发者工具设置。 */
export function setEnableDebug(options: SetEnableDebugOptions) {
  emitRuntimeWarning('[@weapp-vite/web] wx.setEnableDebug 在 Web 端仅兼容调用，请使用浏览器开发者工具调试。', { key: 'setEnableDebug' })
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'setEnableDebug:ok' }))
}

/** 浏览器没有等价的微信键盘高度事件，不推测或保留无法触发的订阅。 */
export function onKeyboardHeightChange(_callback: KeyboardHeightChangeCallback): void {
  emitRuntimeWarning('[@weapp-vite/web] wx.onKeyboardHeightChange 在 Web 端没有等价事件，不会触发回调。', { key: 'onKeyboardHeightChange' })
}

export function offKeyboardHeightChange(_callback?: KeyboardHeightChangeCallback): void {}

/** 浏览器没有等价的微信内存告警事件，不保留无法触发的订阅。 */
export function onMemoryWarning(_callback: MemoryWarningCallback): void {
  emitRuntimeWarning('[@weapp-vite/web] wx.onMemoryWarning 在 Web 端没有等价事件，不会触发回调。', { key: 'onMemoryWarning' })
}

export function offMemoryWarning(_callback?: MemoryWarningCallback): void {}

/** 预览不向微信平台上传监控数据。 */
export function reportMonitor(_name: string, _value: number): void {
  emitRuntimeWarning('[@weapp-vite/web] wx.reportMonitor 在 Web 端仅兼容调用，不会上报到微信平台。', { key: 'reportMonitor' })
}

/** 分块编码原始字节，避免大缓冲区展开参数导致调用栈溢出。 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunks: string[] = []
  for (let start = 0; start < bytes.length; start += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(start, start + 0x8000)))
  }
  return btoa(chunks.join(''))
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}
