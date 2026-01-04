import type { MutableCompilerContext } from '../../context'
import type { ConfigService } from '../config/types'

export function requireConfigService(
  ctx: Pick<MutableCompilerContext, 'configService'>,
  message: string,
): ConfigService {
  const configService = ctx.configService
  if (!configService) {
    throw new Error(message)
  }
  return configService
}
