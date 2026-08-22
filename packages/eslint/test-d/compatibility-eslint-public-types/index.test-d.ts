import type {
  WevuCompatibilityEntry,
  WevuCompatibilityLevel,
  WevuCompatibilitySurface,
} from '@weapp-vite/eslint'
import type { Linter } from 'eslint'
import {
  wevuCompatibilityPlugin,
  wevuCompatibilityRecommended,
} from '@weapp-vite/eslint'
import { expectAssignable, expectError, expectType } from 'tsd'
import {
  findWevuCompatibilityEntry,
  wevuCompatibilityCatalog,
} from 'weapp-vite/compatibility'

expectType<readonly WevuCompatibilityEntry[]>(wevuCompatibilityCatalog)
expectType<WevuCompatibilityEntry | undefined>(
  findWevuCompatibilityEntry('vue', 'hasInjectionContext', 'runtime'),
)
expectError(findWevuCompatibilityEntry('react', 'useState'))
expectType<Linter.Config>(wevuCompatibilityRecommended)
expectAssignable<object>(wevuCompatibilityPlugin)
expectAssignable<WevuCompatibilityLevel>('supported')
expectAssignable<WevuCompatibilitySurface>('runtime')
