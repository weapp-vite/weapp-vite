import { resolvePreludeLog } from '../../../../shared/acceptance'
import { sharedRouteLabel } from '../../../../shared/runtime'

Page({
  data: {
    route: 'independent-subpackage',
    preludeLog: resolvePreludeLog(),
    sharedRouteLabel,
  },
})
