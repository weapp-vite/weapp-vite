import type { BaseLibraryHintState, TemplateCompileOptions } from '@wevu/compiler'
import { createBaseLibraryHintState } from '@wevu/compiler'
import { expectAssignable, expectType } from 'tsd'

const state = createBaseLibraryHintState()
expectType<BaseLibraryHintState>(state)
expectType<Set<string>>(state.reported)

expectAssignable<TemplateCompileOptions>({
  baseLibraryVersion: '2.26.1',
  baseLibraryHintState: state,
})
