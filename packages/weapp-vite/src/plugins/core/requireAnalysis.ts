import type { Plugin } from 'vite'
import type { RequireCallbackToken, RequireToken } from '../utils/ast'
import type { CorePluginState } from './helpers'
import MagicString from 'magic-string'
import path from 'pathe'
import logger from '../../logger'
import { collectRequireTokens } from '../utils/ast'
import { resolveRelativeOutputFileNameWithExtension } from '../utils/outputFileName'

const REQUIRE_ANALYSIS_FILTER_RE = /\.[jt]s$/

export function rewriteRequireCallbacks(code: string, tokens: RequireCallbackToken[]) {
  if (tokens.length === 0) {
    return null
  }

  const source = new MagicString(code)
  for (const token of tokens) {
    source.overwrite(token.callStart, token.start, 'void require.async(')
    source.overwrite(token.end, token.successCallbackStart, ').then(')
  }

  return {
    code: source.toString(),
    map: source.generateMap({ hires: 'boundary' }),
  }
}

export function createRequireAnalysisPlugin(state: CorePluginState): Plugin {
  const { ctx, requireAsyncEmittedChunks } = state
  const { configService } = ctx

  return {
    name: 'weapp-vite:post',
    enforce: 'post',

    transform: {
      filter: {
        id: REQUIRE_ANALYSIS_FILTER_RE,
      },
      handler(code) {
        try {
          const ast = this.parse(code)
          const { requireCallbackTokens, requireTokens } = collectRequireTokens(ast)
          const rewritten = rewriteRequireCallbacks(code, requireCallbackTokens)

          return {
            code: rewritten?.code ?? code,
            ...(rewritten ? {} : { ast }),
            map: rewritten?.map ?? null,
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
          fileName: resolveRelativeOutputFileNameWithExtension(configService, resolved.id, '.js'),
          preserveSignature: 'exports-only',
        })
      }
    },
  }
}
