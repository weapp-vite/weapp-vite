// import { LoadConfigResult } from './loadConfig'
import { injectable } from 'inversify'

@injectable()
export class WxmlService {
  map: Map<string, Set<string>>

  constructor() {
    this.map = new Map()
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
  }
}
