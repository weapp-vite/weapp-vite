import type { CompileVueFileOptions } from '@wevu/compiler'
import { expectAssignable, expectNotAssignable } from 'tsd'

expectAssignable<CompileVueFileOptions>({ renderer: 'auto' })
expectAssignable<CompileVueFileOptions>({ renderer: 'native-dom' })
expectNotAssignable<CompileVueFileOptions>({ renderer: 'unsupported' })
