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

container.bind<CompilerContext>(Symbols.CompilerContext).to(CompilerContext).inTransientScope()

container.bind<WxmlService>(Symbols.WxmlService).to(WxmlService).inRequestScope()
container.bind<WatcherService>(Symbols.WatcherService).to(WatcherService).inRequestScope()
container.bind<ScanService>(Symbols.ScanService).to(ScanService).inRequestScope()
container.bind<AutoImportService>(Symbols.AutoImportService).to(AutoImportService).inRequestScope()
container.bind<BuildService>(Symbols.BuildService).to(BuildService).inRequestScope()

container.bind<JsonService>(Symbols.JsonService).to(JsonService).inSingletonScope()
container.bind<NpmService>(Symbols.NpmService).to(NpmService).inSingletonScope()
container.bind<ConfigService>(Symbols.ConfigService).to(ConfigService).inSingletonScope()

export {
  container,
}
