import type { LocationQuery, MiniProgramHistory, RouterHistory, RouterHistoryAdapter, RouterHistoryContext, RouterHistoryHooks, RouterNavigation } from 'wevu/router'
import { expectError, expectType } from 'tsd'
import { createMiniProgramHistory, createRouter } from 'wevu/router'
import { createExternalQueryHistory, createQueryStore } from '../test/helpers/externalQueryHistory.js'

expectType<MiniProgramHistory>(createMiniProgramHistory())
expectType<RouterNavigation>(createRouter({ history: createMiniProgramHistory() }))
expectType<RouterHistory | undefined>(createRouter().options.history)

const store = createQueryStore()
expectType<LocationQuery | undefined>(store.get('pages/home/index'))
expectType<void>(store.set('pages/home/index', { q: '1' }))
expectType<void>(store.clear())
expectType<void>(store.clear('pages/home/index'))
const external = createExternalQueryHistory(store)
expectType<RouterHistory>(external.history)
expectType<RouterNavigation>(createRouter({ history: external.history }))
expectType<RouterNavigation>(createRouter({ history: { create: () => ({}) } }))

expectType<RouterNavigation>(createRouter({ history: { create: (context) => {
  expectType<RouterHistoryContext>(context)
  expectType<RouterHistoryAdapter>(context.defaultHistory)
  context.getCurrentPage()
  context.notifyLocationChange('/virtual/location')
  context.notifyLocationChange()
  const hooks: RouterHistoryHooks = {
    readLocation: location => ({ ...location, query: { a: '1' } }),
    check: () => undefined,
    push: (to, from) => context.defaultHistory.push(to, from),
    replace: async (to, from) => {
      await context.defaultHistory.replace(to, from)
    },
    resolveGo: (_delta, from) => ({ target: from }),
    go: () => {},
    resetLocation: () => {},
  }
  return hooks
} } }))

expectError(createRouter({ history: { create: () => ({ push: () => false }) } }))
expectError(createRouter({ history: { create: () => ({ resolveNavigation: () => ({ kind: 'unknown' }) }) } }))
expectError(createRouter({ history: { create: () => ({ readLocation: () => 42 }) } }))
