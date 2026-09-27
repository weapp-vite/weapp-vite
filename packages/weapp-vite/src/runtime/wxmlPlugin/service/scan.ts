import type { ScanWxmlResult } from '../../../wxml'
import type { WxmlServiceState } from './shared'
import { createHash } from 'node:crypto'
import { removeExtensionDeep } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/fs'
import { isEmptyObject } from '../../../context/shared'
import logger from '../../../logger'
import { getCompilerSourceSnapshot, readCompilerInput, readCompilerSourceSnapshot } from '../../../plugins/utils/sourceSnapshot'
import { scanWxml } from '../../../wxml'
import { requireConfigService } from '../../utils/requireConfigService'
import { invalidateAggregatedComponents } from './shared'

export function createWxmlScanner(
  state: WxmlServiceState,
  options: {
    setTokenDeps: (filepath: string, deps?: ScanWxmlResult['deps']) => Promise<void>
  },
) {
  function analyze(wxml: string) {
    const configService = requireConfigService(state.ctx, '扫描 WXML 前必须初始化 configService。')
    const wxmlConfig = configService.weappViteConfig?.wxml ?? configService.weappViteConfig?.enhance?.wxml
    return scanWxml(wxml, {
      platform: configService.platform,
      ...(wxmlConfig === true ? {} : (wxmlConfig ?? {})),
    })
  }

  async function scan(filepath: string) {
    const configService = requireConfigService(state.ctx, '扫描 WXML 前必须初始化 configService。')
    const pinned = readCompilerSourceSnapshot(getCompilerSourceSnapshot(configService), filepath)
    let stat: { mtimeMs?: number, ctimeMs?: number, size?: number } = {}
    try {
      if (pinned === undefined) {
        stat = await fs.stat(filepath)
      }
    }
    catch (error: any) {
      if (error && error.code === 'ENOENT') {
        const baseName = removeExtensionDeep(filepath)
        state.tokenMap.delete(filepath)
        state.cache.delete(filepath)
        state.componentsMap.delete(baseName)
        state.autoImportComponentsMap.delete(baseName)
        state.templatePathMap.delete(baseName)
        invalidateAggregatedComponents(state, filepath, state.aggregatedComponentsMap)
        invalidateAggregatedComponents(state, filepath, state.aggregatedAutoImportComponentsMap)
        // 移除已经不存在的 outgoing 依赖，保留其他模板对该路径的引用以跟踪恢复。
        await options.setTokenDeps(filepath, [])
        logger.warn(`引用模板 \`${configService.relativeCwd(filepath)}\` 不存在!`)
        return
      }
      throw error
    }

    const signature = pinned === undefined
      ? `${stat.mtimeMs ?? ''}:${stat.ctimeMs ?? ''}:${stat.size ?? ''}`
      : `snapshot:${createHash('sha256').update(pinned).digest('hex')}`
    const shouldRescan = await state.cache.isInvalidate(filepath, { signature, checkMtime: false })
    if (!shouldRescan) {
      const cached = state.cache.get(filepath)
      if (cached) {
        state.tokenMap.set(filepath, cached)
        return cached
      }
    }

    const wxml = await readCompilerInput(configService, filepath)
    const res = analyze(wxml)
    state.tokenMap.set(filepath, res)
    state.cache.set(filepath, res)
    const baseName = removeExtensionDeep(filepath)
    const autoImportComponentEntries = res.autoImportComponents ?? res.components ?? {}
    if (isEmptyObject(autoImportComponentEntries)) {
      state.autoImportComponentsMap.delete(baseName)
    }
    else {
      state.autoImportComponentsMap.set(baseName, autoImportComponentEntries)
    }
    invalidateAggregatedComponents(state, filepath, state.aggregatedAutoImportComponentsMap)
    await options.setTokenDeps(filepath, res.deps)
    return res
  }

  return {
    analyze,
    scan,
  }
}
