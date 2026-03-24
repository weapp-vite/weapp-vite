/* eslint-disable no-console */

import { useRelayToken } from '../../action/relay'
import { common } from '../../shared/common'
import { inlineOnly } from '../../shared/inline-only'
import { pathOnly } from '../../shared/path-only'
import { subOnly } from '../../shared/sub-only'
import { useVendor } from '../../shared/vendor'

const tokens = [
  common(),
  subOnly(),
  useRelayToken(),
  pathOnly(),
  inlineOnly(),
  useVendor(),
]

Page({
  data: {
    route: 'packageA/pages/foo',
    title: 'chunk modes packageA',
    tokens,
  },
  onLoad() {
    tokens.forEach(token => console.log(token))
  },
  _runE2E() {
    return {
      ok: this.data.tokens.length === tokens.length,
      route: this.data.route,
      tokens: this.data.tokens,
    }
  },
})
