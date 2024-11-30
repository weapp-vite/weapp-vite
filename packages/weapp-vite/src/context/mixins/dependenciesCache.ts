import type { CompilerContext } from '../CompilerContext'
import { isObject, objectHash } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'

export function dependenciesCache(proto: CompilerContext) {
  Object.defineProperty(proto, 'dependenciesCacheFilePath', {
    get() {
      return path.resolve(this.cwd, 'node_modules/weapp-vite/.cache/npm.json')
    },
  })

  Object.defineProperty(proto, 'dependenciesCacheHash', {
    get() {
      return objectHash(this.packageJson.dependencies ?? {})
    },
  })

  proto.writeDependenciesCache = function writeDependenciesCache() {
    return fs.outputJSON(this.dependenciesCacheFilePath, {
      '/': this.dependenciesCacheHash,
    })
  }

  proto.readDependenciesCache = async function readDependenciesCache() {
    if (await fs.exists(this.dependenciesCacheFilePath)) {
      return await fs.readJson(this.dependenciesCacheFilePath, { throws: false })
    }
  }

  proto.checkDependenciesCacheOutdate = async function checkDependenciesCacheOutdate() {
    const json = await this.readDependenciesCache()
    if (isObject(json)) {
      return this.dependenciesCacheHash !== json['/']
    }
    return true
  }
}
