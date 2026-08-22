/* eslint-disable no-console -- 构建夹具通过可观察调用保留待验证模块。 */
import { rootSingle } from '../../root-single'
import { common } from '../../shared/common'
import { inlineOnly } from '../../shared/inline-only'
import { pathOnly } from '../../shared/path-only'
import { single } from '../../shared/single'
import { useVendor } from '../../shared/vendor'

console.log(common())
console.log(pathOnly())
console.log(single())
console.log(inlineOnly())
console.log(useVendor())
console.log(rootSingle())

void import('./async')
