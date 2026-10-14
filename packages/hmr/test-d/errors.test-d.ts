import { HmrPreparationCleanupError } from '@weapp-vite/hmr'
import { expectAssignable, expectType } from 'tsd'

const primary: unknown = new Error('preparation failed')
const cleanups: readonly unknown[] = [new Error('cleanup failed')]
const error = new HmrPreparationCleanupError(primary, cleanups)
expectAssignable<AggregateError>(error)
expectType<unknown>(error.cause)
