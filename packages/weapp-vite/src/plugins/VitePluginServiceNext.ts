import type { CompilerContext } from '@/context'
import type { Entry, SubPackageMetaValue } from '@/types'
import type { ChangeEvent, InputOptions, OutputBundle, PluginContext } from 'rollup'
import type { ResolvedConfig } from 'vite'

export class VitePluginService {
  resolvedConfig!: ResolvedConfig
  entriesSet: Set<string>
  entries: Entry[]

  constructor(public ctx: CompilerContext) {
    this.entriesSet = new Set()
    this.entries = []
  }

  addModulesHot(pluginContext: PluginContext) {

  }

  resetCache() {

  }

  async preOptions(options: InputOptions, subPackageMeta?: SubPackageMetaValue) {

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
}
