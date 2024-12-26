import type { LoadConfigOptions, LoadConfigResult } from './context/loadConfig'
import process from 'node:process'
import { defu } from '@weapp-core/shared'
import { Container } from 'inversify'
import { CompilerContext, JsonService, NpmService, Symbols, WxmlService } from './context/index'
import { loadConfig } from './context/loadConfig'

const container = new Container()
container.bind<CompilerContext>(Symbols.CompilerContext).to(CompilerContext)
container.bind<JsonService>(Symbols.JsonService).to(JsonService)
container.bind<NpmService>(Symbols.NpmService).to(NpmService)
container.bind<WxmlService>(Symbols.WxmlService).to(WxmlService)
container.bind<LoadConfigResult | undefined>(Symbols.Config).toDynamicValue(() => {
  const opts = defu<LoadConfigOptions, LoadConfigOptions[]>({}, {
    cwd: process.cwd(),
    isDev: false,
    mode: 'development',
  })
  return loadConfig(opts)
}).inSingletonScope()

export default container
