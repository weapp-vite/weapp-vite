import type {
  ComponentDefinition,
  ComputedDefinitions,
  MethodDefinitions,
  WevuComponentConstructor,
} from 'wevu'
import { expectAssignable, expectType } from 'tsd'

import { label, shared } from '../dist-lib-file/lib/components/button'
import SfcBoth from '../dist-lib-file/lib/components/sfc-both'
import SfcScript from '../dist-lib-file/lib/components/sfc-script'
import SfcSetup from '../dist-lib-file/lib/components/sfc-setup'
import { useUtil } from '../dist-lib-file/lib/utils'

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
expectAssignable<ComponentDefinition<any, ComputedDefinitions, MethodDefinitions>>(SfcBoth)
expectAssignable<SfcComponent>(SfcScript)
expectAssignable<SfcComponent>(SfcSetup)
expectAssignable<ComponentDefinition<any, ComputedDefinitions, MethodDefinitions>>(SfcSetup)
