import type { Entry } from '@/types'
import type { ConfigService } from '.'
import { resolveJson } from '@/utils'
import { fs, parseCommentJson } from '@weapp-core/shared'
import { bundleRequire } from 'bundle-require'
import { inject, injectable } from 'inversify'
import { getCompilerContext } from '../getInstance'
import { logger } from '../shared'
import { Symbols } from '../Symbols'

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

  resolve(entry: Partial<Pick<Entry, 'json' | 'jsonPath' | 'type'>>) {
    return resolveJson(entry, this.configService.aliasEntries)
  }
}
