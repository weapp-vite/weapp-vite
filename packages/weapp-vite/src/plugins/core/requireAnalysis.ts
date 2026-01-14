import type { Plugin } from 'vite'
import type { RequireToken } from '../utils/ast'
import type { CorePluginState } from './helpers'
import path from 'pathe'
import logger from '../../logger'
import { changeFileExtension } from '../../utils/file'
import { collectRequireTokens } from '../utils/ast'

export function createRequireAnalysisPlugin(state: CorePluginState): Plugin {
  const { ctx, requireAsyncEmittedChunks } = state
  const { configService } = ctx

  return {
    name: 'weapp-vite:post',
    enforce: 'post',

    transform: {
      filter: {
        id: /\.[jt]s$/,
      },
      handler(code) {
        try {
          const ast = this.parse(code)
          const { requireTokens } = collectRequireTokens(ast)

          return {
            code,
            ast,
            map: null,
            meta: { requireTokens },
          }
        }
        catch (error) {
          logger.error(error)
        }
      },
    },

    async moduleParsed(moduleInfo) {
      const requireTokens = moduleInfo.meta.requireTokens as RequireToken[]
      if (!Array.isArray(requireTokens)) {
        return
      }

      for (const requireModule of requireTokens) {
        const absPath = path.resolve(path.dirname(moduleInfo.id), requireModule.value)
        const resolved = await this.resolve(absPath, moduleInfo.id)
        if (!resolved) {
          continue
        }

        await this.load(resolved)
        if (requireAsyncEmittedChunks.has(resolved.id)) {
          continue
        }

        requireAsyncEmittedChunks.add(resolved.id)
        this.emitFile({
          type: 'chunk',
          id: resolved.id,
          fileName: configService.relativeOutputPath(
            changeFileExtension(resolved.id, '.js'),
          ),
          preserveSignature: 'exports-only',
        })
      }
    },
  }
}
