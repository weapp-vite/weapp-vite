import type { MutableCompilerContext } from '../../context'
import { requireConfigService } from '../utils/requireConfigService'

export function getPackNpmRelationList(ctx: MutableCompilerContext) {
  const configService = requireConfigService(ctx, 'configService must be initialized before resolving npm relation list')
  let packNpmRelationList: {
    packageJsonPath: string
    miniprogramNpmDistDir: string
  }[] = []
  if (configService.projectConfig.setting?.packNpmManually && Array.isArray(configService.projectConfig.setting.packNpmRelationList)) {
    packNpmRelationList = configService.projectConfig.setting.packNpmRelationList
  }
  else {
    packNpmRelationList = [
      {
        miniprogramNpmDistDir: '.',
        packageJsonPath: './package.json',
      },
    ]
  }
  return packNpmRelationList
}
