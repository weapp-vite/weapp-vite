import type { HmrRuntimeFallbackReason } from '../hmrRuntimeCapabilities'
import type { StatefulHmrOutputFile } from './outputWriter'
import { HmrAssetStore } from '@weapp-vite/hmr'
import { resolveStatefulHmrOutputFallback } from '../hmrRuntimeCapabilities'

type StylesheetAsset = Extract<StatefulHmrOutputFile, { type: 'asset' }>

/** 仅记录原生写出成功的样式字节，独立于快照失败后的强制重放状态。 */
export class StatefulHmrOutputCapabilities {
  private readonly stylesheets = new HmrAssetStore<StylesheetAsset>()
  private initialized = false
  private readonly suffix: string

  constructor(private readonly styleExtension: string) {
    this.suffix = `.${styleExtension.replace(/^\./, '').toLowerCase()}`
  }

  fallback(output: readonly StatefulHmrOutputFile[], removed: readonly string[] = []): HmrRuntimeFallbackReason | undefined {
    if (!this.initialized) {
      return
    }
    const assets = this.select(output)
    if (!assets.length && !removed.some(file => file.toLowerCase().endsWith(this.suffix))) {
      return
    }
    const retained = this.stylesheets.ownedNames().filter(file => !removed.includes(file))
    const changes = this.stylesheets.diff(assets, retained)
    return resolveStatefulHmrOutputFallback({ ...changes, styleExtension: this.styleExtension })
  }

  /** 调用方必须在原生写盘与所有权提交均成功后推进基线；省略的文件继续保留。 */
  published(output: readonly StatefulHmrOutputFile[], removed: readonly string[], fullBuild: boolean): void {
    const assets = this.select(output)
    if (!assets.length && !removed.some(file => file.toLowerCase().endsWith(this.suffix))) {
      this.initialized ||= fullBuild
      return
    }
    const next = new Map(Array.from(this.stylesheets.values(), asset => [asset.fileName, asset]))
    for (const file of removed) {
      next.delete(file)
    }
    for (const asset of assets) {
      next.set(asset.fileName, asset)
    }
    this.stylesheets.adopt(next.values())
    this.initialized ||= fullBuild
  }

  private select(output: readonly StatefulHmrOutputFile[]): StylesheetAsset[] {
    return output.filter((item): item is StylesheetAsset => item.type === 'asset' && item.fileName.toLowerCase().endsWith(this.suffix))
  }
}
