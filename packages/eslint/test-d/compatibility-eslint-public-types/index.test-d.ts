import type {
  MiniProgramRuntimeApiEntry,
  MiniProgramRuntimeConfigOptions,
  WevuCompatibilityEntry,
  WevuCompatibilityLevel,
  WevuCompatibilitySurface,
} from '@weapp-vite/eslint'
import type { Linter } from 'eslint'
import {
  createMiniProgramRuntimeConfig,
  miniProgramRuntimeApiCatalog,
  miniProgramRuntimePlugin,
  miniProgramRuntimeRecommended,
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
expectType<readonly MiniProgramRuntimeApiEntry[]>(miniProgramRuntimeApiCatalog)
expectType<Linter.Config>(miniProgramRuntimeRecommended)
expectType<Linter.Config>(createMiniProgramRuntimeConfig())
expectType<Linter.Config>(createMiniProgramRuntimeConfig({
  files: ['app/**/*.ts'],
  ignores: ['app/**/*.web.ts'],
} satisfies MiniProgramRuntimeConfigOptions))
expectAssignable<object>(miniProgramRuntimePlugin)
expectAssignable<object>(wevuCompatibilityPlugin)
expectAssignable<WevuCompatibilityLevel>('supported')
expectAssignable<WevuCompatibilitySurface>('runtime')
