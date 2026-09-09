import { resolvePreludeLog } from '../../../../shared/acceptance'
import { sharedRouteLabel } from '../../../../shared/runtime'

Page({
  data: {
    route: 'normal-subpackage',
    preludeLog: resolvePreludeLog(),
    sharedRouteLabel,
  },
})
