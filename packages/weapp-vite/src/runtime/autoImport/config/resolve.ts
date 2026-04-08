import type { MutableCompilerContext } from '../../../context'
import path from 'pathe'
import {
  DEFAULT_AUTO_IMPORT_MANIFEST_FILENAME,
  isProductionBuildWithInternalSupportFiles,
  resolveBaseDir,
  WEAPP_VITE_INTERNAL_DIRNAME,
} from './base'
import { getAutoImportConfig } from './defaults'

export function resolveManifestOutputPath(
  configService?: MutableCompilerContext['configService'],
  manifestFileName = DEFAULT_AUTO_IMPORT_MANIFEST_FILENAME,
) {
  if (!configService) {
    return undefined
  }

  const autoImportConfig = getAutoImportConfig(configService)
  if (!autoImportConfig) {
    return undefined
  }

  const baseDir = resolveBaseDir(configService)
  const outputOption = autoImportConfig.output
  if (outputOption === false) {
    return undefined
  }

  if (typeof outputOption === 'string' && outputOption.length > 0) {
    return path.isAbsolute(outputOption) ? outputOption : path.resolve(baseDir, outputOption)
  }

  if (isProductionBuildWithInternalSupportFiles(configService)) {
    return undefined
  }

  return path.resolve(baseDir, WEAPP_VITE_INTERNAL_DIRNAME, manifestFileName)
}
