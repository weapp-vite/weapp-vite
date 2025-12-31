import type { MpPlatform } from '@/types'

export interface OutputExtensions {
  js: string
  json: string
  wxml: string
  wxss: string
  wxs?: string
}

export interface MiniProgramPlatformAdapter {
  /**
   * 构建流程中使用的标准平台标识。
   */
  id: MpPlatform
  /**
   * 用于日志/诊断/工具展示的可读名称。
   */
  displayName: string
  /**
   * 需要映射到该平台的别名列表。
   */
  aliases: readonly string[]
  /**
   * 编译产物应输出的文件扩展名。
   */
  outputExtensions: OutputExtensions
}
