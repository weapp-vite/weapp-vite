import type { LoadConfigOptions } from './context/ConfigService'
import type { CompilerContext, ConfigService } from './context/index'
import { Symbols } from './context/Symbols'
import { container } from './inversify.config'

export async function createCompilerContext(options?: Partial<LoadConfigOptions>) {
  const configService = container.get<ConfigService>(Symbols.ConfigService)
  await configService.load(options)
  const ctx = container.get<CompilerContext>(Symbols.CompilerContext)
  return ctx
}
