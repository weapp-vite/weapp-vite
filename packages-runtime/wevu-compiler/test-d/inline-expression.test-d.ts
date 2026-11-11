import type { InlineExpressionAsset } from '@wevu/compiler'
import { expectError, expectType } from 'tsd'

const existing: InlineExpressionAsset = {
  id: 'i0',
  expression: 'ctx.count.value++',
  scopeKeys: [],
  parameterNames: { context: 'ctx', scope: 'scope', event: 'event' },
}
const withHelper: InlineExpressionAsset = {
  ...existing,
  expression: 'unwrap(ctx.controls).scope = true',
  runtimeHelpers: { unref: 'unwrap' },
}
expectType<string | undefined>(withHelper.runtimeHelpers?.unref)
expectError<InlineExpressionAsset>({ ...existing, runtimeHelpers: { unref: 1 } })
