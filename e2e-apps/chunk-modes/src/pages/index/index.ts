/* eslint-disable no-console */

import { common } from '../../shared/common'
import { inlineOnly } from '../../shared/inline-only'
import { pathOnly } from '../../shared/path-only'
import { useVendor } from '../../shared/vendor'

console.log(common())
console.log(pathOnly())
console.log(inlineOnly())
console.log(useVendor())

void import('./async')
