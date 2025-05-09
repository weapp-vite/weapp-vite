import type { Entry } from '@/types'
import type { ConfigService } from '.'
// import { FileCache } from '@/cache'
import { resolveJson } from '@/utils'
import { bundleRequire } from 'bundle-require'
import { parse as parseJson } from 'comment-json'
import fs from 'fs-extra'
import { inject, injectable } from 'inversify'
import { getCompilerContext } from '../getInstance'
import { debug, logger } from '../shared'
import { Symbols } from '../Symbols'

export function parseCommentJson(json: string) {
  return parseJson(json, undefined, true)
}

@injectable()
export class JsonService {
  // cache: FileCache<any>
  constructor(
    @inject(Symbols.ConfigService)
    private readonly configService: ConfigService,
  ) {
    // this.cache = new FileCache()
  }

  async read(filepath: string) {
    try {
      // const invalid = await this.cache.isInvalidate(filepath)
      // if (!invalid) {
      //   return this.cache.get(filepath)
      // }
      let resultJson: any
      if (/\.json\.[jt]s$/.test(filepath)) {
        const { mod } = await bundleRequire({
          filepath,
          cwd: this.configService.options.cwd,
          esbuildOptions: {
            define: this.configService.defineImportMetaEnv,
          },
        })
        resultJson = typeof mod.default === 'function'
          ? await mod.default(
            getCompilerContext(),
          )
          : mod.default
      }
      else {
        resultJson = parseCommentJson(await fs.readFile(filepath, 'utf8'))
      }
      // this.cache.set(filepath, resultJson)
      return resultJson
    }
    catch (error) {
      logger.error(`残破的JSON文件: ${filepath}`)
      debug?.(error)
      // logger.error(error)
    }
  }

  resolve(entry: Partial<Pick<Entry, 'json' | 'jsonPath' | 'type'>>) {
    return resolveJson(entry, this.configService.aliasEntries)
  }
}
