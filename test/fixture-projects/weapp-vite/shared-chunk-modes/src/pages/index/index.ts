import { common } from '../../shared/common'
import { pathOnly } from '../../shared/path-only'
import { single } from '../../shared/single'
import { inlineOnly } from '../../shared/inline-only'
import { useVendor } from '../../shared/vendor'

console.log(common())
console.log(pathOnly())
console.log(single())
console.log(inlineOnly())
console.log(useVendor())

void import('./async')
