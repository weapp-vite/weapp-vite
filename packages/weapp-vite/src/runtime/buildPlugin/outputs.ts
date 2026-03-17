import type { MutableCompilerContext } from '../../context'
import { cp, mkdir, readdir, stat } from 'node:fs/promises'
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

export async function syncExternalPluginOutputs(
  configService: NonNullable<MutableCompilerContext['configService']>,
) {
  const pluginOutputRoot = configService.absolutePluginOutputRoot
  const pluginRoot = configService.absolutePluginRoot
  if (!pluginOutputRoot || !pluginRoot) {
    return
  }

  const relativeToOutDir = path.relative(configService.outDir, pluginOutputRoot)
  const isInsideOutDir = relativeToOutDir === '' || (!relativeToOutDir.startsWith('..') && !path.isAbsolute(relativeToOutDir))
  if (isInsideOutDir) {
    return
  }

  const pluginBundleRoot = path.resolve(pluginOutputRoot, path.basename(pluginRoot))
  try {
    await stat(pluginBundleRoot)
  }
  catch {
    return
  }

  await mkdir(pluginOutputRoot, { recursive: true })
  const entries = await readdir(pluginBundleRoot)
  await Promise.all(entries.map(async (entry) => {
    await cp(path.resolve(pluginBundleRoot, entry), path.resolve(pluginOutputRoot, entry), {
      recursive: true,
      force: true,
    })
  }))
  await rimraf(pluginBundleRoot)
  logger.success(`已整理插件产物到 ${configService.relativeCwd(pluginOutputRoot)} 目录`)
}
