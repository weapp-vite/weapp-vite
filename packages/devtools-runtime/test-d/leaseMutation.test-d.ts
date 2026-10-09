import { mutateLease } from '@weapp-vite/devtools-runtime'
import { expectError, expectType } from 'tsd'

expectType<Promise<number>>(mutateLease('journal', async () => 42))
expectType<Promise<{ owned: true }>>(mutateLease('journal', async () => ({ owned: true }), { timeoutMs: 45_000 }))
expectError(mutateLease('journal', () => 42))
expectError(mutateLease('journal', async () => undefined, { timeoutMs: '45_000' }))
