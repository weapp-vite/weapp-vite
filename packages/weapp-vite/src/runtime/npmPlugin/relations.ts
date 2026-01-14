import type { MutableCompilerContext } from '../../context'
import { requireConfigService } from '../utils/requireConfigService'

export function getPackNpmRelationList(ctx: MutableCompilerContext) {
  const configService = requireConfigService(ctx, '解析 npm 关联列表前必须初始化 configService。')
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
