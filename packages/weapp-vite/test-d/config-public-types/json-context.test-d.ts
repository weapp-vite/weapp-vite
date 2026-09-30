import type { JsonMergeContext } from 'weapp-vite/config'
import type { JsonMergeContext as CompilerContext } from 'wevu/compiler'
import { expectType } from 'tsd'
import { defineConfig } from 'weapp-vite/config'

declare const context: JsonMergeContext
expectType<CompilerContext>(context)
defineConfig({ weapp: { json: { mergeStrategy(target, source, ctx) {
  expectType<JsonMergeContext>(ctx)
  expectType<string | undefined>(ctx.routeConfig?.name)
  return { ...target, ...source }
} } } })
