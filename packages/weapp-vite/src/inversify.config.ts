import { Container } from 'inversify'
import { CompilerContext, ConfigService, JsonService, NpmService, SubPackageService, WatcherService, WxmlService } from './context/index'
import { Symbols } from './context/Symbols'

const container = new Container()

container.bind<CompilerContext>(Symbols.CompilerContext).to(CompilerContext).inSingletonScope()
container.bind<JsonService>(Symbols.JsonService).to(JsonService).inSingletonScope()
container.bind<NpmService>(Symbols.NpmService).to(NpmService).inSingletonScope()
container.bind<WxmlService>(Symbols.WxmlService).to(WxmlService).inSingletonScope()
container.bind<ConfigService>(Symbols.ConfigService).to(ConfigService).inSingletonScope()
container.bind<SubPackageService>(Symbols.SubPackageService).to(SubPackageService).inSingletonScope()
container.bind<WatcherService>(Symbols.WatcherService).to(WatcherService).inSingletonScope()
export {
  container,
}
