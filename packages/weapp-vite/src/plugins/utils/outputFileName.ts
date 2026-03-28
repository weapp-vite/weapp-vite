import type { CompilerContext } from '../../context'
import { changeFileExtension } from '../../utils/file'
import { jsonFileRemoveJsExtension } from '../../utils/json'

type OutputPathConfigService = Pick<NonNullable<CompilerContext['configService']>, 'relativeOutputPath'>

/**
 * 统一生成相对输出文件名，避免各插件重复拼接。
 */
export function resolveRelativeOutputFileName(
  configService: OutputPathConfigService,
  filePath: string,
) {
  return configService.relativeOutputPath(filePath)
}

/**
 * 基于源码路径生成带目标扩展名的相对输出文件名。
 */
export function resolveRelativeOutputFileNameWithExtension(
  configService: OutputPathConfigService,
  filePath: string,
  extension: string,
) {
  return changeFileExtension(
    resolveRelativeOutputFileName(configService, filePath),
    extension,
  )
}

/**
 * 统一处理 json 入口可能残留的 `.js` 后缀。
 */
export function resolveRelativeJsonOutputFileName(
  configService: OutputPathConfigService,
  filePath: string,
) {
  return resolveRelativeOutputFileName(
    configService,
    jsonFileRemoveJsExtension(filePath),
  )
}
