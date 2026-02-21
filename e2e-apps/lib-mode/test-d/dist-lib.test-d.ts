import type {
  ComputedDefinitions,
  MethodDefinitions,
  WevuComponentConstructor,
} from 'wevu'
import { expectAssignable, expectType } from 'tsd'

import { label, shared } from '../dist-lib/components/button'
import SfcBoth from '../dist-lib/components/sfc-both'
import SfcScript from '../dist-lib/components/sfc-script'
import SfcSetup from '../dist-lib/components/sfc-setup'
import { useUtil } from '../dist-lib/utils'

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
