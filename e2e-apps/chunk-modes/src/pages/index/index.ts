/* eslint-disable no-console */

import { common } from '../../shared/common'
import { inlineOnly } from '../../shared/inline-only'
import { pathOnly } from '../../shared/path-only'
import { scenarioId } from '../../shared/scenario'
import { useVendor } from '../../shared/vendor'

const tokens = [
  common(),
  pathOnly(),
  inlineOnly(),
  useVendor(),
]

Page({
  data: {
    route: 'pages/index/index',
    scenarioId,
    title: 'shared chunk modes',
    tokens,
  },
  onLoad() {
    tokens.forEach(token => console.log(token))
    void import('./async')
  },
  _runE2E() {
    return {
      ok: this.data.tokens.length === tokens.length,
      route: this.data.route,
      scenarioId: this.data.scenarioId,
      tokens: this.data.tokens,
    }
  },
})
