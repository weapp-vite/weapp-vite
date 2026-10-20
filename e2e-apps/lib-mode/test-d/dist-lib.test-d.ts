import type {
  ComputedDefinitions,
  MethodDefinitions,
  WevuComponentConstructor,
} from 'wevu'
import { expectAssignable, expectType } from 'tsd'

import { label, shared } from '../dist-lib/components/button/index.js'
import SfcBoth from '../dist-lib/components/sfc-both/index.js'
import SfcScript from '../dist-lib/components/sfc-script/index.js'
import SfcSetup from '../dist-lib/components/sfc-setup/index.js'
import { useUtil } from '../dist-lib/utils/index.js'

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
