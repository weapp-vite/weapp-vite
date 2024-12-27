import type { ConfigService, JsonService } from '.'
import type { ResolvedValue } from '../../auto-import-components/resolvers'
import type { Entry, SubPackageMetaValue } from '../../types'
import { removeExtension, removeExtensionDeep } from '@weapp-core/shared'
import { inject, injectable } from 'inversify'
import pm from 'picomatch'
import { findJsEntry, findJsonEntry } from '../../utils'
import { logger, resolvedComponentName } from '../shared'
import { Symbols } from '../Symbols'

@injectable()
export class AutoImportService {
  // for auto import
  potentialComponentMap: Map<string, {
    entry: Entry
    value: ResolvedValue
  }>

  constructor(
    @inject(Symbols.ConfigService)
    private readonly configService: ConfigService,
    @inject(Symbols.JsonService)
    private readonly jsonService: JsonService,
  ) {
    this.potentialComponentMap = new Map() // 初始化潜在组件映射
  }

  // for auto import
  async scanPotentialComponentEntries(filePath: string) {
    const baseName = removeExtension(filePath)
    const jsEntry = await findJsEntry(baseName)
    if (!jsEntry) { // || this.entriesSet.has(jsEntry)
      return
    }
    if (jsEntry) {
      const jsonPath = await findJsonEntry(baseName)
      if (jsonPath) {
        const json = await this.jsonService.read(jsonPath)
        if (json?.component) { // json.component === true
          const partialEntry: Entry = {
            path: jsEntry,
            json,
            jsonPath,
            type: 'component',
            templatePath: filePath,
          }
          const componentName = resolvedComponentName(baseName)
          if (componentName) {
            if (this.potentialComponentMap.has(componentName)) {
              logger.warn(`发现组件重名! 跳过组件 ${this.configService.relativeCwd(baseName)} 的自动引入`)
              return
            }
            this.potentialComponentMap.set(componentName, {
              entry: partialEntry,
              value: {
                name: componentName,
                from: `/${this.configService.relativeSrcRoot(
                  this.configService.relativeCwd(
                    removeExtensionDeep(partialEntry.jsonPath!),
                  ),
                )}`,
              },
            })
          }
        }
      }
    }
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
