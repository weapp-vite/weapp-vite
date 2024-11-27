import type { CompilerContext } from '../CompilerContext'
import { bundleRequire } from 'bundle-require'
import { parse as parseJson } from 'comment-json'
import fs from 'fs-extra'
import { logger } from '../shared'

export function parseCommentJson(json: string) {
  return parseJson(json, undefined, true)
}

export async function readCommentJson(this: CompilerContext, filepath: string) {
  try {
    if (/\.json\.[jt]s$/.test(filepath)) {
      const { mod } = await bundleRequire({
        filepath,
        cwd: this.cwd,
        esbuildOptions: {
          define: this.defineImportMetaEnv,
        },
      })
      return typeof mod.default === 'function' ? await mod.default(this) : mod.default
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
