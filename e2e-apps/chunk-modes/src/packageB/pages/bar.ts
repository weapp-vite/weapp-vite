/* eslint-disable no-console */

import { common } from '../../shared/common'
import { inlineOnly } from '../../shared/inline-only'
import { subOnly } from '../../shared/sub-only'
import { useVendor } from '../../shared/vendor'

const tokens = [
  common(),
  subOnly(),
  inlineOnly(),
  useVendor(),
]

Page({
  data: {
    route: 'packageB/pages/bar',
    title: 'chunk modes packageB',
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
