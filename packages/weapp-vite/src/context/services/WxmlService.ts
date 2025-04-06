import type { ComponentsMap } from '@/types'
import type { ScanWxmlResult } from '@/wxml'
import type { ConfigService } from '.'
import logger from '@/logger'
import { isTemplate } from '@/utils'
import { isImportTag, scanWxml } from '@/wxml'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import { inject, injectable } from 'inversify'
import path from 'pathe'
import { isEmptyObject } from '../shared'
import { Symbols } from '../Symbols'

@injectable()
export class WxmlService {
  map: Map<string, Set<string>>
  tokenMap: Map<string, ScanWxmlResult>
  wxmlComponentsMap: Map<string, ComponentsMap>
  constructor(
    @inject(Symbols.ConfigService)
    private readonly configService: ConfigService,
  ) {
    // 是否扫描过的依赖 map
    this.map = new Map()
    this.tokenMap = new Map()
    this.wxmlComponentsMap = new Map() // 初始化wxml组件映射
  }

  async addDeps(filepath: string, deps: string[] = []) {
    // 新扫描文件
    if (!this.map.has(filepath)) {
      const set = new Set<string>()
      for (const dep of deps) {
        set.add(dep)
      }
      this.map.set(filepath, set)

      await Promise.all(deps.map((dep) => {
        return this.scan(dep)
      }))
    }
    else {
      const setRef = this.map.get(filepath)
      if (setRef) {
        for (const dep of deps) {
          setRef.add(dep)
        }
      }
    }
  }

  getAllDeps() {
    const set = new Set<string>()
    for (const [key, value] of this.map) {
      set.add(key)
      for (const item of value) {
        set.add(item)
      }
    }
    return set
  }

  clear() {
    this.map.clear()
    this.tokenMap.clear()
  }

  analyze(wxml: string) {
    return scanWxml(wxml, {
      platform: this.configService.platform,
      ...(
        this.configService.weappViteConfig?.enhance?.wxml === true
          ? {}
          : this.configService.weappViteConfig?.enhance?.wxml),
    })
  }

  async scan(filepath: string) {
    if (await fs.exists(filepath)) {
      const dirname = path.dirname(filepath)
      const wxml = await fs.readFile(filepath, 'utf8')
      const res = this.analyze(wxml)

      this.tokenMap.set(filepath, res)
      await this.addDeps(
        filepath,
        res.deps.filter(x => isImportTag(x.tagName) && isTemplate(x.value)).map(
          (x) => {
            if (x.value.startsWith('/')) {
              return path.resolve(this.configService.absoluteSrcRoot, x.value.slice(1))
            }
            else {
              return path.resolve(dirname, x.value)
            }
          },
        ),
      )
      return res
    }
    else {
      // 引用失败的情况，这里可以打印一些 log
      logger.warn(`引用模板 ${this.configService.relativeCwd(filepath)} 不存在!`)
    }
  }

  setWxmlComponentsMap(absPath: string, components: ComponentsMap) {
    if (!isEmptyObject(components)) {
      this.wxmlComponentsMap.set(removeExtensionDeep(absPath), components)
    }
  }
}
