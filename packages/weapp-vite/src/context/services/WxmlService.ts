import type { ScanWxmlResult } from '@/wxml'
import type { ConfigService } from '.'
import { scanWxml } from '@/wxml'
import fs from 'fs-extra'
import { inject, injectable } from 'inversify'
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

  addDeps(filepath: string, deps: string[] = []) {
    if (!this.map.has(filepath)) {
      const set = new Set<string>()
      for (const dep of deps) {
        set.add(dep)
      }
      this.map.set(filepath, set)
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
    const wxml = await fs.readFile(filepath, 'utf8')
    const res = scanWxml(wxml, {
      platform: this.configService.platform,
    })
    this.tokenMap.set(filepath, res)
    return res
  }
}
