import type { CompilerContext } from '@/context/CompilerContext'
import type { VitePluginService } from '@/plugins/VitePluginService'

export interface WeappVitePluginApi {
  ctx: CompilerContext
  service: VitePluginService
}
