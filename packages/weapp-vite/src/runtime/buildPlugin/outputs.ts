import type { MutableCompilerContext } from '../../context'
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises'
import path from 'pathe'
import { debug, logger } from '../../context/shared'
import { getPreservedNpmDirNames } from '../../platform'

function resolvePreservedNpmDirNames(configService: NonNullable<MutableCompilerContext['configService']>) {
  return new Set(getPreservedNpmDirNames(configService.platform, {
    alipayNpmMode: configService.weappViteConfig?.npm?.alipayNpmMode,
  }))
}

export function isOutputRootInsideOutDir(outDir: string, pluginOutputRoot: string) {
  const relativeToOutDir = path.relative(outDir, pluginOutputRoot)
  return relativeToOutDir === '' || (!relativeToOutDir.startsWith('..') && !path.isAbsolute(relativeToOutDir))
}

async function removeDirectoryEntries(
  root: string,
  options: {
    preserveDirNames?: Set<string>
  } = {},
) {
  const entries = await readdir(root, { withFileTypes: true }).catch((error: any) => {
    if (error?.code === 'ENOENT') {
      return []
    }
    throw error
  })
  const deletedPaths: string[] = []

  await Promise.all(entries.map(async (entry) => {
    if (options.preserveDirNames?.has(entry.name)) {
      return
    }

    const absolutePath = path.resolve(root, entry.name)
    await rm(absolutePath, {
      recursive: true,
      force: true,
    })
    deletedPaths.push(absolutePath)
  }))

  return deletedPaths.sort()
}

export function resetEmittedOutputCaches(
  runtimeState: MutableCompilerContext['runtimeState'],
) {
  runtimeState.json.emittedSource.clear()
  runtimeState.asset.emittedBuffer.clear()
  runtimeState.css.emittedSource.clear()
  runtimeState.wxml.emittedCode.clear()
}

export async function cleanOutputs(
  configService: NonNullable<MutableCompilerContext['configService']>,
) {
  if (configService.mpDistRoot) {
    const preservedNpmDirNames = resolvePreservedNpmDirNames(configService)
    const deletedFilePaths = await removeDirectoryEntries(configService.outDir, {
      preserveDirNames: preservedNpmDirNames,
    })
    debug?.('deletedFilePaths', deletedFilePaths)
    logger.success(`已清空 ${configService.mpDistRoot} 目录`)
  }
  const pluginOutputRoot = configService.absolutePluginOutputRoot
  if (pluginOutputRoot) {
    if (!isOutputRootInsideOutDir(configService.outDir, pluginOutputRoot)) {
      const deletedPluginFiles = await removeDirectoryEntries(pluginOutputRoot)
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

  if (isOutputRootInsideOutDir(configService.outDir, pluginOutputRoot)) {
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
  await rm(pluginBundleRoot, {
    recursive: true,
    force: true,
  })
  logger.success(`已整理插件产物到 ${configService.relativeCwd(pluginOutputRoot)} 目录`)
}
