import type { ResolveSfcBlockSrcOptions } from '@wevu/compiler'
import { expectAssignable, expectError, expectType } from 'tsd'

type Reader = NonNullable<ResolveSfcBlockSrcOptions['readFile']>

const reader: Reader = async (id, options) => {
  expectType<string>(id)
  expectType<boolean | undefined>(options?.checkMtime)
  expectType<'template' | 'script' | 'style' | undefined>(options?.blockType)
  return ''
}

expectType<Promise<string>>(reader('template.ts', { checkMtime: false, blockType: 'template' }))
expectError(reader('template.ts', { blockType: 'json' }))
expectAssignable<Reader>(async (_id: string, _options?: { checkMtime?: boolean }) => '')
expectAssignable<Reader>(async (_id: string) => '')
