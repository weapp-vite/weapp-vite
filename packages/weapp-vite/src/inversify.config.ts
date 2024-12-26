import { Container } from 'inversify'
import { CompilerContext, ConfigService, EnvService, JsonService, NpmService, SubPackageService, WxmlService } from './context/index'
import { Symbols } from './context/Symbols'

const container = new Container()

container.bind<CompilerContext>(Symbols.CompilerContext).to(CompilerContext).inSingletonScope()
container.bind<JsonService>(Symbols.JsonService).to(JsonService).inSingletonScope()
container.bind<NpmService>(Symbols.NpmService).to(NpmService).inSingletonScope()
container.bind<WxmlService>(Symbols.WxmlService).to(WxmlService).inSingletonScope()
container.bind<ConfigService>(Symbols.ConfigService).to(ConfigService).inSingletonScope()
container.bind<EnvService>(Symbols.EnvService).to(EnvService).inSingletonScope()
container.bind<SubPackageService>(Symbols.SubPackageService).to(SubPackageService).inSingletonScope()

export {
  container,
}
