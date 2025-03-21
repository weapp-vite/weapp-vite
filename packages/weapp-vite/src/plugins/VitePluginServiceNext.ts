import type { CompilerContext } from '@/context'
import type { AppEntry, Entry, SubPackageMetaValue } from '@/types'
import type { ChangeEvent, InputOptions, OutputBundle, PluginContext } from 'rollup'
import type { Plugin, ResolvedConfig } from 'vite'
import { } from 'vite'

export class VitePluginService {
  resolvedConfig!: ResolvedConfig
  entriesMap: Map<string, Entry>
  appEntry!: AppEntry

  constructor(public ctx: CompilerContext) {
    this.entriesMap = new Map()
  }

  preConfigResolved(config: ResolvedConfig) {
    const idx = config.plugins?.findIndex(x => x.name === 'vite:build-import-analysis')
    if (idx > -1) {
      (config.plugins as Plugin<any>[]).splice(idx, 1)
    }
  }

  addModulesHot(pluginContext: PluginContext) {

  }

  resetCache() {

  }

  async preOptions(options: InputOptions) {
    const app = await this.ctx.scanService.loadAppEntry()
    if (app) {
      options.input = app.path
      this.appEntry = app
      this.entriesMap.set(app.path, app)
    }
  }

  preBuildStart(pluginContext: PluginContext) {

  }

  preBuildEnd(pluginContext: PluginContext) {

  }

  preResolveId(id: string) {

  }

  async preLoad(id: string, pluginContext: PluginContext) {

  }

  async preGenerateBundle(bundle: OutputBundle, pluginContext: PluginContext) {

  }

  preWatchChange(id: string, change: { event: ChangeEvent }) {

  }

  async loadAppDeps(pluginCtx: PluginContext) {
    for (const page of this.appEntry.json.pages) {
      const entry = await this.ctx.scanService.loadPageEntry(page)
      if (entry) {
        const resolveId = await pluginCtx.resolve(entry.path)
        if (resolveId) {
          this.entriesMap.set(entry.path, entry)
          await pluginCtx.load(resolveId)
        }
      }
    }
    if (this.appEntry.json.usingComponents) {
      for (const [, rawUrl] of Object.entries(this.appEntry.json.usingComponents)) {
        const componentUrl = rawUrl
        const entry = await this.ctx.scanService.loadComponentEntry(componentUrl as string)
        if (entry) {
          const resolveId = await pluginCtx.resolve(entry.path)
          if (resolveId) {
            this.entriesMap.set(entry.path, entry)
            await pluginCtx.load(resolveId)
          }
        }
      }
    }
  }
}
