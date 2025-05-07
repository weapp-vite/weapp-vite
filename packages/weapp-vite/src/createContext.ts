import type { CompilerContext, ConfigService, LoadConfigOptions } from './context'
import { Symbols } from './context/Symbols'
import { container } from './inversify.config'

export async function createCompilerContext(options?: Partial<LoadConfigOptions>) {
  // 先初始化 ConfigService
  const configService = container.get<ConfigService>(Symbols.ConfigService)
  await configService.load(options)
  return container.get<CompilerContext>(Symbols.CompilerContext)
}
