import type {
  ComputedDefinitions,
  MethodDefinitions,
  WevuComponentConstructor,
} from 'wevu'
import { expectAssignable, expectType } from 'tsd'

import {
  label as duplicateCommonLabel,
  shared as duplicateCommonShared,
} from '../dist-matrix/duplicate-common/components/button/index.js'
import DuplicateCommonSfcBoth from '../dist-matrix/duplicate-common/components/sfc-both/index.js'
import DuplicateCommonSfcScript from '../dist-matrix/duplicate-common/components/sfc-script/index.js'
import DuplicateCommonSfcSetup from '../dist-matrix/duplicate-common/components/sfc-setup/index.js'
import { useUtil as duplicateCommonUseUtil } from '../dist-matrix/duplicate-common/utils/index.js'
import {
  label as duplicateInlineLabel,
  shared as duplicateInlineShared,
} from '../dist-matrix/duplicate-inline/components/button/index.js'
import DuplicateInlineSfcBoth from '../dist-matrix/duplicate-inline/components/sfc-both/index.js'
import DuplicateInlineSfcScript from '../dist-matrix/duplicate-inline/components/sfc-script/index.js'
import DuplicateInlineSfcSetup from '../dist-matrix/duplicate-inline/components/sfc-setup/index.js'
import { useUtil as duplicateInlineUseUtil } from '../dist-matrix/duplicate-inline/utils/index.js'
import {
  label as duplicatePathLabel,
  shared as duplicatePathShared,
} from '../dist-matrix/duplicate-path/components/button/index.js'
import DuplicatePathSfcBoth from '../dist-matrix/duplicate-path/components/sfc-both/index.js'
import DuplicatePathSfcScript from '../dist-matrix/duplicate-path/components/sfc-script/index.js'
import DuplicatePathSfcSetup from '../dist-matrix/duplicate-path/components/sfc-setup/index.js'
import { useUtil as duplicatePathUseUtil } from '../dist-matrix/duplicate-path/utils/index.js'
import {
  label as hoistCommonLabel,
  shared as hoistCommonShared,
} from '../dist-matrix/hoist-common/components/button/index.js'
import HoistCommonSfcBoth from '../dist-matrix/hoist-common/components/sfc-both/index.js'
import HoistCommonSfcScript from '../dist-matrix/hoist-common/components/sfc-script/index.js'
import HoistCommonSfcSetup from '../dist-matrix/hoist-common/components/sfc-setup/index.js'
import { useUtil as hoistCommonUseUtil } from '../dist-matrix/hoist-common/utils/index.js'
import {
  label as hoistInlineLabel,
  shared as hoistInlineShared,
} from '../dist-matrix/hoist-inline/components/button/index.js'
import HoistInlineSfcBoth from '../dist-matrix/hoist-inline/components/sfc-both/index.js'
import HoistInlineSfcScript from '../dist-matrix/hoist-inline/components/sfc-script/index.js'
import HoistInlineSfcSetup from '../dist-matrix/hoist-inline/components/sfc-setup/index.js'
import { useUtil as hoistInlineUseUtil } from '../dist-matrix/hoist-inline/utils/index.js'
import {
  label as hoistPathLabel,
  shared as hoistPathShared,
} from '../dist-matrix/hoist-path/components/button/index.js'
import HoistPathSfcBoth from '../dist-matrix/hoist-path/components/sfc-both/index.js'
import HoistPathSfcScript from '../dist-matrix/hoist-path/components/sfc-script/index.js'
import HoistPathSfcSetup from '../dist-matrix/hoist-path/components/sfc-setup/index.js'
import { useUtil as hoistPathUseUtil } from '../dist-matrix/hoist-path/utils/index.js'

type SfcComponent = WevuComponentConstructor<
  any,
  any,
  any,
  ComputedDefinitions,
  MethodDefinitions
>

expectType<'button'>(duplicateCommonLabel)
expectType<string>(duplicateCommonShared)
expectType<string>(duplicateCommonUseUtil())
expectAssignable<SfcComponent>(DuplicateCommonSfcBoth)
expectAssignable<SfcComponent>(DuplicateCommonSfcScript)
expectAssignable<SfcComponent>(DuplicateCommonSfcSetup)

expectType<'button'>(duplicateInlineLabel)
expectType<string>(duplicateInlineShared)
expectType<string>(duplicateInlineUseUtil())
expectAssignable<SfcComponent>(DuplicateInlineSfcBoth)
expectAssignable<SfcComponent>(DuplicateInlineSfcScript)
expectAssignable<SfcComponent>(DuplicateInlineSfcSetup)

expectType<'button'>(duplicatePathLabel)
expectType<string>(duplicatePathShared)
expectType<string>(duplicatePathUseUtil())
expectAssignable<SfcComponent>(DuplicatePathSfcBoth)
expectAssignable<SfcComponent>(DuplicatePathSfcScript)
expectAssignable<SfcComponent>(DuplicatePathSfcSetup)

expectType<'button'>(hoistCommonLabel)
expectType<string>(hoistCommonShared)
expectType<string>(hoistCommonUseUtil())
expectAssignable<SfcComponent>(HoistCommonSfcBoth)
expectAssignable<SfcComponent>(HoistCommonSfcScript)
expectAssignable<SfcComponent>(HoistCommonSfcSetup)

expectType<'button'>(hoistInlineLabel)
expectType<string>(hoistInlineShared)
expectType<string>(hoistInlineUseUtil())
expectAssignable<SfcComponent>(HoistInlineSfcBoth)
expectAssignable<SfcComponent>(HoistInlineSfcScript)
expectAssignable<SfcComponent>(HoistInlineSfcSetup)

expectType<'button'>(hoistPathLabel)
expectType<string>(hoistPathShared)
expectType<string>(hoistPathUseUtil())
expectAssignable<SfcComponent>(HoistPathSfcBoth)
expectAssignable<SfcComponent>(HoistPathSfcScript)
expectAssignable<SfcComponent>(HoistPathSfcSetup)
