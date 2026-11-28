import { markNativePageLoad, resolvePreludeLog, resolveRequestRuntimeState } from '../../../../shared/acceptance'
import { sharedRouteLabel } from '../../../../shared/runtime'

Page({
  data: {
    route: 'independent-subpackage',
    preludeLog: resolvePreludeLog(),
    sharedRouteLabel,
    requestRuntime: resolveRequestRuntimeState(),
  },
  onLoad() {
    markNativePageLoad('independent')
  },
})
