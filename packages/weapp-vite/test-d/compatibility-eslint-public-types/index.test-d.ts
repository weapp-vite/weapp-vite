import type { Linter } from 'eslint'
import type { WevuCompatibilityEntry } from 'weapp-vite/compatibility'
import { expectAssignable, expectError, expectType } from 'tsd'
import {
  findWevuCompatibilityEntry,
  wevuCompatibilityCatalog,
} from 'weapp-vite/compatibility'
import {
  wevuCompatibilityPlugin,
  wevuCompatibilityRecommended,
} from 'weapp-vite/eslint'

expectType<readonly WevuCompatibilityEntry[]>(wevuCompatibilityCatalog)
expectType<WevuCompatibilityEntry | undefined>(
  findWevuCompatibilityEntry('vue', 'hasInjectionContext', 'runtime'),
)
expectError(findWevuCompatibilityEntry('react', 'useState'))
expectType<Linter.Config>(wevuCompatibilityRecommended)
expectAssignable<object>(wevuCompatibilityPlugin)
