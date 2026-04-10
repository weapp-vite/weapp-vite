import type { ScanWxmlResult } from '../../../wxml'
import type { WxmlServiceState } from './shared'
import { fs, removeExtensionDeep } from '@weapp-core/shared'
import { isEmptyObject } from '../../../context/shared'
import logger from '../../../logger'
import { scanWxml } from '../../../wxml'
import { requireConfigService } from '../../utils/requireConfigService'
import { invalidateAggregatedComponents } from './shared'

export function createWxmlScanner(
  state: WxmlServiceState,
  options: {
    collectDepsFromToken: (filepath: string, deps?: ScanWxmlResult['deps']) => string[]
    setDeps: (filepath: string, deps?: string[]) => Promise<void>
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
    let stat: { mtimeMs?: number, ctimeMs?: number, size?: number }
    try {
      stat = await fs.stat(filepath)
    }
    catch (error: any) {
      if (error && error.code === 'ENOENT') {
        logger.warn(`引用模板 \`${configService.relativeCwd(filepath)}\` 不存在!`)
        return
      }
      throw error
    }

    const signature = `${stat.mtimeMs ?? ''}:${stat.ctimeMs ?? ''}:${stat.size ?? ''}`
    const shouldRescan = await state.cache.isInvalidate(filepath, { signature, checkMtime: false })
    if (!shouldRescan) {
      const cached = state.cache.get(filepath)
      if (cached) {
        state.tokenMap.set(filepath, cached)
        return cached
      }
    }

    const wxml = await fs.readFile(filepath, 'utf8')
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
    await options.setDeps(filepath, options.collectDepsFromToken(filepath, res.deps))
    return res
  }

  return {
    analyze,
    scan,
  }
}
