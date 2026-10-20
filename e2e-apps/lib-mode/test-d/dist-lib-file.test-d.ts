import type {
  ComputedDefinitions,
  MethodDefinitions,
  WevuComponentConstructor,
} from 'wevu'
import { expectAssignable, expectType } from 'tsd'

import { label, shared } from '../dist-lib-file/lib/components/button/index.js'
import SfcBoth from '../dist-lib-file/lib/components/sfc-both/index.js'
import SfcScript from '../dist-lib-file/lib/components/sfc-script/index.js'
import SfcSetup from '../dist-lib-file/lib/components/sfc-setup/index.js'
import { useUtil } from '../dist-lib-file/lib/utils/index.js'

type SfcComponent = WevuComponentConstructor<
  any,
  any,
  any,
  ComputedDefinitions,
  MethodDefinitions
>

expectType<'button'>(label)
expectType<string>(shared)
expectType<string>(useUtil())

expectAssignable<SfcComponent>(SfcBoth)
expectAssignable<SfcComponent>(SfcScript)
expectAssignable<SfcComponent>(SfcSetup)
