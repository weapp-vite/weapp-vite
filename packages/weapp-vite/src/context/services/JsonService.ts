import type { ConfigService } from '.'
import { bundleRequire } from 'bundle-require'
import { parse as parseJson } from 'comment-json'
import fs from 'fs-extra'
import { inject, injectable } from 'inversify'
import { getCompilerContext } from '../getInstance'
import { logger } from '../shared'
import { Symbols } from '../Symbols'

export function parseCommentJson(json: string) {
  return parseJson(json, undefined, true)
}

@injectable()
export class JsonService {
  constructor(
    @inject(Symbols.ConfigService)
    private readonly configService: ConfigService,
  ) {
  }

  async read(filepath: string) {
    try {
      if (/\.json\.[jt]s$/.test(filepath)) {
        const { mod } = await bundleRequire({
          filepath,
          cwd: this.configService.options.cwd,
          esbuildOptions: {
            define: this.configService.defineImportMetaEnv,
          },
        })
        return typeof mod.default === 'function'
          ? await mod.default(
            getCompilerContext(),
          )
          : mod.default
      }
      else {
        return parseCommentJson(await fs.readFile(filepath, 'utf8'))
      }
    }
    catch (error) {
      logger.error(`残破的JSON文件: ${filepath}`)
      logger.error(error)
    }
  }
}
