import type { DirectiveResult } from 'lit/directive.js'
import { createRenderContext } from '@weapp-vite/web'
import { expectAssignable, expectError } from 'tsd'

declare const owner: Parameters<typeof createRenderContext>[0]
const context = createRenderContext(owner, {})
expectAssignable<DirectiveResult>(context.controlledAttribute('refresher-triggered', scope => Boolean(scope.triggered), {}))
expectError(context.controlledAttribute('refresher-triggered', false, {}))
expectError(context.controlledAttribute('refresher-triggered', () => false, null))
expectAssignable<Record<string, unknown>>(context.mergeScope({}, { renamed: false }, [{ key: 'renamed', read: scope => scope.triggered }]))
expectAssignable<Record<string, unknown>>(context.createScope({}, { item: false }, [{ key: 'item', read: scope => scope.values, index: 0 }]))
expectError(context.mergeScope({}, {}, [{ key: 'renamed', read: false }]))
