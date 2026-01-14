import type { MutableCompilerContext } from '../../context'
import path from 'pathe'
import { rimraf } from 'rimraf'
import { debug, logger } from '../../context/shared'

export async function cleanOutputs(
  configService: NonNullable<MutableCompilerContext['configService']>,
) {
  if (configService.mpDistRoot) {
    const deletedFilePaths = await rimraf(
      [
        path.resolve(configService.outDir, '*'),
        path.resolve(configService.outDir, '.*'),
      ],
      {
        glob: true,
        filter: (filePath) => {
          if (filePath.includes('miniprogram_npm')) {
            return false
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
