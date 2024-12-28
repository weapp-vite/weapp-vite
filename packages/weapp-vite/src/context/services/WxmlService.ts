import type { ScanWxmlResult } from '@/wxml'
import type { ConfigService } from '.'
import logger from '@/logger'
import { isTemplate } from '@/utils'
import { isImportTag, scanWxml } from '@/wxml'
import fs from 'fs-extra'
import { inject, injectable } from 'inversify'
import path from 'pathe'
import { Symbols } from '../Symbols'

@injectable()
export class WxmlService {
  map: Map<string, Set<string>>
  tokenMap: Map<string, ScanWxmlResult>
  constructor(
    @inject(Symbols.ConfigService)
    private readonly configService: ConfigService,
  ) {
    this.map = new Map()
    this.tokenMap = new Map()
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

  async scan(filepath: string) {
    if (await fs.exists(filepath)) {
      const dirname = path.dirname(filepath)
      const wxml = await fs.readFile(filepath, 'utf8')
      const res = scanWxml(wxml, {
        platform: this.configService.platform,
      })
      this.tokenMap.set(filepath, res)
      await this.addDeps(filepath, res.deps.filter(x => isImportTag(x.tagName) && isTemplate(x.value)).map(
        x =>
          path.resolve(dirname, x.value),
      ))
      return res
    }
    else {
      // 引用失败的情况，这里可以打印一些 log
      logger.warn(`引用模板 ${this.configService.relativeCwd(filepath)} 不存在!`)
    }
  }
}
