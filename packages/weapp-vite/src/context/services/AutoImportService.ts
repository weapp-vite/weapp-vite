import type { ResolvedValue } from '@/auto-import-components/resolvers'
import type { Entry, SubPackageMetaValue } from '@/types'
import type { ConfigService, JsonService } from '.'
import { findJsEntry, findJsonEntry } from '@/utils'
import { removeExtension, removeExtensionDeep } from '@weapp-core/shared'
import { inject, injectable } from 'inversify'
import pm from 'picomatch'
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
          // 优先 [name]/index > [name]/[name]
          const { componentName, isIndex } = resolvedComponentName(baseName)
          if (componentName) {
            // 所以这样写能够导致 [name]/index 的组件，直接去覆盖 [name]/[name] 组件
            const hasComponent = this.potentialComponentMap.has(componentName)
            if (hasComponent && !isIndex) {
              logger.warn(`发现 \`${componentName}\` 组件重名! 跳过组件 \`${this.configService.relativeCwd(baseName)}\` 的自动引入`)
              return
            }
            if (hasComponent) {
              logger.warn(`发现 \`${componentName}\` 组件重名! 使用组件的 \`${this.configService.relativeCwd(baseName)}\` 作为自动引入`)
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
    if (this.configService.weappViteConfig?.enhance?.autoImportComponents?.globs) {
      const isMatch = pm(this.configService.weappViteConfig.enhance.autoImportComponents.globs, {
        cwd: this.configService.cwd,
        windows: true,
        posixSlashes: true,
      })
      return isMatch(id)
    }
    return false
  }
}
