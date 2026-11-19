import type { OutputBundle } from 'rolldown'
import type { NpmPackageFilesConfig } from '../../../types'
import type { PreparedNpmOutput } from '../output'
import { Buffer } from 'node:buffer'
import logger from '../../../logger'
import { collectClosures } from './closure'
import { buildReferenceGraph, collectPackages, logicalFileName, packageInfo } from './graph'

function outputBytes(output: PreparedNpmOutput) {
  return [...output.assets, ...[...output.external.values()].flat()]
    .reduce((total, asset) => total + Buffer.from(asset.source).byteLength, 0)
}

/** 基于最终构建输出裁剪 npm 文件；动态或未知引用会按边界回退保留。 */
export function pruneNpmOutput(output: PreparedNpmOutput, bundle: OutputBundle, options: {
  enabled?: boolean
  packageFiles?: Record<string, NpmPackageFilesConfig>
}) {
  if (!options.enabled) {
    return
  }
  const originalFiles = output.assets.length + [...output.external.values()].reduce((count, assets) => count + assets.length, 0)
  const originalBytes = outputBytes(output)
  const packages = collectPackages(output)
  const graph = buildReferenceGraph(bundle, packages)
  const keepByRoot = collectClosures(packages, graph)
  const diagnostics = new Set<string>()

  for (const [root, entry] of packages) {
    if (options.packageFiles?.[entry.name]) {
      keepByRoot.set(root, new Set(entry.files.keys()))
      continue
    }
    const state = graph.packages.get(root)
    const baseFallback = graph.fallbackBases.get(entry.boundary)
    if (baseFallback) {
      diagnostics.add(`[npm] ${entry.name} 所属 npm 目标中的加载方式无法静态确定，已保留该目标内全部 npm 包：${baseFallback}`)
      continue
    }
    if (state?.fallback) {
      diagnostics.add(`[npm] ${entry.name} 内的加载方式无法静态确定，已保留该包全部文件：${state.fallback}`)
    }
    const kept = keepByRoot.get(root)!
    if (kept.size) {
      for (const metadata of ['package.json', 'LICENSE', 'LICENSE.md', 'LICENSE.txt']) {
        if (entry.files.has(metadata)) {
          kept.add(metadata)
        }
      }
    }
    if (!kept.size) {
      diagnostics.add(`[npm] ${entry.name} 在最终产物中没有静态引用，已移除未引用文件。`)
    }
  }

  for (const diagnostic of diagnostics) {
    logger.warn(diagnostic)
  }
  output.assets = output.assets.filter((asset) => {
    if (!asset.fileName) {
      return true
    }
    const info = packageInfo(asset.fileName)
    return !info || keepByRoot.get(info.root)?.has(info.relative) === true
  })
  for (const [directory, assets] of output.external) {
    output.external.set(directory, assets.filter((asset) => {
      if (!asset.fileName) {
        return true
      }
      const info = packageInfo(logicalFileName(output, directory, asset.fileName))
      return !info || keepByRoot.get(info.root)?.has(info.relative) === true
    }))
  }
  const retainedFiles = output.assets.length + [...output.external.values()].reduce((count, assets) => count + assets.length, 0)
  if (retainedFiles < originalFiles) {
    logger.info(`[npm] 按实际引用裁剪 ${originalFiles - retainedFiles} 个文件，减少 ${originalBytes - outputBytes(output)} 字节（构建磁盘产物，不代表微信上传包体）。`)
  }
  logger.info(`[npm] 构建磁盘产物包含 ${retainedFiles} 个本地 npm 文件，共 ${outputBytes(output)} 字节；该值不代表微信上传包体。`)
}
