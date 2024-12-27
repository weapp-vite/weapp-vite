import type { SubPackageMetaValue } from '../../types'
import type { ConfigService } from './ConfigService'
import { inject, injectable } from 'inversify'
import pm from 'picomatch'
import { Symbols } from '../Symbols'

@injectable()
export class AutoImportService {
  constructor(
    @inject(Symbols.ConfigService)
    private readonly configService: ConfigService,
  ) {

  }

  filter(id: string, _meta?: SubPackageMetaValue): boolean {
    if (this.configService.inlineConfig.weapp?.enhance?.autoImportComponents?.globs) {
      const isMatch = pm(this.configService.inlineConfig.weapp.enhance.autoImportComponents.globs, {
        cwd: this.configService.cwd,
        windows: true,
        posixSlashes: true,
      })
      return isMatch(id)
    }
    return false
  }
}
