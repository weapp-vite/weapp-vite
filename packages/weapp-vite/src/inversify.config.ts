import { Container } from 'inversify'
import {
  AutoImportService,
  BuildService,
  CompilerContext,
  ConfigService,
  JsonService,
  NpmService,
  ScanService,
  WatcherService,
  WxmlService,
} from './context'
import { Symbols } from './context/Symbols'

const container = new Container()

container.bind<CompilerContext>(Symbols.CompilerContext).to(CompilerContext).inSingletonScope()
container.bind<JsonService>(Symbols.JsonService).to(JsonService).inSingletonScope()
container.bind<NpmService>(Symbols.NpmService).to(NpmService).inSingletonScope()
container.bind<WxmlService>(Symbols.WxmlService).to(WxmlService).inSingletonScope()
container.bind<ConfigService>(Symbols.ConfigService).to(ConfigService).inSingletonScope()
container.bind<WatcherService>(Symbols.WatcherService).to(WatcherService).inSingletonScope()
container.bind<ScanService>(Symbols.ScanService).to(ScanService).inSingletonScope()
container.bind<AutoImportService>(Symbols.AutoImportService).to(AutoImportService).inSingletonScope()
container.bind<BuildService>(Symbols.BuildService).to(BuildService).inSingletonScope()

export {
  container,
}
