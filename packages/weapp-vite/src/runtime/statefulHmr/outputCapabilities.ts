import type { HmrRuntimeFallbackReason } from '../hmrRuntimeCapabilities'
import type { StatefulHmrOutputFile } from './outputWriter'
import { HmrAssetStore } from '@weapp-vite/hmr'
import { resolveStatefulHmrOutputFallback } from '../hmrRuntimeCapabilities'

type VisualAsset = Extract<StatefulHmrOutputFile, { type: 'asset' }>

/** 仅记录原生写出成功的模板与样式字节，独立于快照失败后的强制重放状态。 */
export class StatefulHmrOutputCapabilities {
  private readonly visuals = new HmrAssetStore<VisualAsset>()
  private initialized = false
  private readonly suffixes: string[]

  constructor(private readonly styleExtension: string, private readonly templateExtension?: string) {
    this.suffixes = [styleExtension, ...templateExtension ? [templateExtension] : []].map(extension => `.${extension.replace(/^\./, '').toLowerCase()}`)
  }

  fallback(output: readonly StatefulHmrOutputFile[], removed: readonly string[] = [], hasRuntime = true): HmrRuntimeFallbackReason | undefined {
    if (!this.initialized) {
      return
    }
    const assets = this.select(output)
    if (!assets.length && !removed.some(file => this.matches(file))) {
      return
    }
    const retained = this.visuals.ownedNames().filter(file => !removed.includes(file))
    const changes = this.visuals.diff(assets, retained)
    return resolveStatefulHmrOutputFallback({ ...changes, styleExtension: this.styleExtension, templateExtension: hasRuntime ? this.templateExtension : undefined })
  }

  /** 调用方必须在原生写盘与所有权提交均成功后推进基线；省略的文件继续保留。 */
  published(output: readonly StatefulHmrOutputFile[], removed: readonly string[], fullBuild: boolean): void {
    const assets = this.select(output)
    if (!assets.length && !removed.some(file => this.matches(file))) {
      this.initialized ||= fullBuild
      return
    }
    const next = new Map(Array.from(this.visuals.values(), asset => [asset.fileName, asset]))
    for (const file of removed) {
      next.delete(file)
    }
    for (const asset of assets) {
      next.set(asset.fileName, asset)
    }
    this.visuals.adopt(next.values())
    this.initialized ||= fullBuild
  }

  private matches(file: string): boolean {
    return this.suffixes.some(suffix => file.toLowerCase().endsWith(suffix))
  }

  private select(output: readonly StatefulHmrOutputFile[]): VisualAsset[] {
    return output.filter((item): item is VisualAsset => item.type === 'asset' && this.matches(item.fileName))
  }
}
