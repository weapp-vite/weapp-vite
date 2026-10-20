import type { createCompilerContext } from 'weapp-vite'
import { expectError, expectType } from 'tsd'

type CompilerContext = Awaited<ReturnType<typeof createCompilerContext>>

declare const service: CompilerContext['autoRoutesService']

expectType<string | undefined>(service.getSourceFingerprint('src/pages/index.vue'))
expectError(service.getSourceFingerprint(123))
expectError(service.getSourceFingerprint())
