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
  /**
   * IDE 项目配置文件名。
   */
  projectConfigFileName: string
  /**
   * 项目根目录候选字段，按优先级排序。
   */
  projectConfigRootKeys: readonly string[]
  /**
   * 不同脚本模块扩展名对应的模板标签名。
   */
  scriptModuleTagByExtension?: Readonly<Partial<Record<string, string>>>
  /**
   * 是否使用项目根目录作为 npm 产物目录基准。
   */
  usesProjectRootNpmDir?: boolean
  /**
   * IDE 打开项目时的平台级默认行为。
   */
  ide?: {
    requiresOpenPlatformArg?: boolean
    defaultProjectRoot?: string
  }
  /**
   * 构建清理时需要保留的 npm 产物目录名。
   */
  resolvePreservedNpmDirNames: (options?: {
    alipayNpmMode?: string
  }) => readonly string[]
  /**
   * JSON 归一化相关的平台能力。
   */
  json?: {
    normalizeUsingComponents?: boolean
    fillComponentGenericsDefault?: boolean
    rewriteBundleNpmImports?: boolean
  }
  /**
   * npm 构建相关的平台能力。
   */
  npm?: {
    distDirName?: (options?: {
      alipayNpmMode?: string
    }) => string
    normalizeMiniprogramPackage?: boolean
    copyEsModuleDirectory?: boolean
    hoistNestedDependencies?: boolean
    shouldRebuildCachedPackage?: boolean
  }
  /**
   * WXML / 模板转换相关的平台能力。
   */
  wxml?: {
    eventBindingStyle?: 'default' | 'alipay'
    directivePrefix?: string
    normalizeComponentTagName?: boolean
    normalizeVueTemplate?: boolean
    emitGenericPlaceholder?: boolean
  }
  /**
   * TypeScript 支持相关的平台能力。
   */
  typescript?: {
    appTypesPackage?: string
  }
}
