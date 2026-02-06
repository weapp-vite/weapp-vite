import type { MutableCompilerContext } from '../../context'
import path from 'pathe'
import { rimraf } from 'rimraf'
import { debug, logger } from '../../context/shared'
import { getAlipayNpmDistDirName } from '../../utils/alipayNpm'

function resolvePreservedNpmDirNames(configService: NonNullable<MutableCompilerContext['configService']>) {
  if (configService.platform === 'alipay') {
    return new Set([getAlipayNpmDistDirName(configService.weappViteConfig?.npm?.alipayNpmMode)])
  }
  return new Set(['miniprogram_npm'])
}

export async function cleanOutputs(
  configService: NonNullable<MutableCompilerContext['configService']>,
) {
  if (configService.mpDistRoot) {
    const preservedNpmDirNames = resolvePreservedNpmDirNames(configService)
    const deletedFilePaths = await rimraf(
      [
        path.resolve(configService.outDir, '*'),
        path.resolve(configService.outDir, '.*'),
      ],
      {
        glob: true,
        filter: (filePath) => {
          for (const dirName of preservedNpmDirNames) {
            if (filePath.includes(`${path.sep}${dirName}`)) {
              return false
            }
          }
          return true
        },
      },
    )
    debug?.('deletedFilePaths', deletedFilePaths)
    logger.success(`已清空 ${configService.mpDistRoot} 目录`)
  }
  const pluginOutputRoot = configService.absolutePluginOutputRoot
  if (pluginOutputRoot) {
    const relativeToOutDir = path.relative(configService.outDir, pluginOutputRoot)
    const isInsideOutDir = relativeToOutDir === '' || (!relativeToOutDir.startsWith('..') && !path.isAbsolute(relativeToOutDir))
    if (!isInsideOutDir) {
      const deletedPluginFiles = await rimraf([
        path.resolve(pluginOutputRoot, '*'),
        path.resolve(pluginOutputRoot, '.*'),
      ], {
        glob: true,
      })
      debug?.('deletedPluginOutput', deletedPluginFiles)
      logger.success(`已清空 ${configService.relativeCwd(pluginOutputRoot)} 目录`)
    }
  }
}
