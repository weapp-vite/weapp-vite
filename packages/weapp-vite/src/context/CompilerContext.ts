import type { AutoImportService } from '../runtime/autoImportPlugin'
import type { BuildService } from '../runtime/buildPlugin'
import type { ConfigService } from '../runtime/config/types'
import type { JsonService } from '../runtime/jsonPlugin'
import type { NpmService } from '../runtime/npmPlugin'
import type { RuntimeState } from '../runtime/runtimeState'
import type { ScanService } from '../runtime/scanPlugin'
import type { WatcherService } from '../runtime/watcherPlugin'
import type { WxmlService } from '../runtime/wxmlPlugin'
import '../config'

export interface CompilerContext {
  runtimeState: RuntimeState
  configService: ConfigService
  npmService: NpmService
  wxmlService: WxmlService
  jsonService: JsonService
  watcherService: WatcherService
  autoImportService: AutoImportService
  buildService: BuildService
  scanService: ScanService
}

export type MutableCompilerContext = Partial<Omit<CompilerContext, 'runtimeState'>> & {
  runtimeState: RuntimeState
  configService?: ConfigService
  npmService?: NpmService
  wxmlService?: WxmlService
  jsonService?: JsonService
  watcherService?: WatcherService
  autoImportService?: AutoImportService
  buildService?: BuildService
  scanService?: ScanService
}
