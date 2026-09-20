import { resolvePreludeLog, resolveRequestRuntimeState } from '../../shared/acceptance'
import { sharedRouteLabel } from '../../shared/runtime'

Page({
  data: {
    route: 'main',
    sharedRouteLabel,
    preludeLog: resolvePreludeLog(),
    requestRuntime: resolveRequestRuntimeState(),
  },
})
