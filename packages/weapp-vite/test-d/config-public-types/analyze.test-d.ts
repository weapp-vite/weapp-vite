import type { WeappViteConfig } from 'weapp-vite/config'
import { expectAssignable, expectError } from 'tsd'

expectAssignable<WeappViteConfig>({ analyze: { budgets: { runtimeBytes: 100_000, packageBytes: { 'subpackages/detail': 500_000 } } } })
expectError<WeappViteConfig>({ analyze: { budgets: { runtimeBytes: '100kb' } } })
expectError<WeappViteConfig>({ analyze: { budgets: { packageBytes: { detail: 'large' } } } })
