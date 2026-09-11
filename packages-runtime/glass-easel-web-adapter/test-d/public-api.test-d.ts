import type { GlassEaselWebAdapter, GlassEaselWebSnapshot } from '../src/index'
import { expectAssignable, expectType } from 'tsd'
import {
  createGlassEaselWebAdapter,
  getGlassEaselRuntimeInfo,

} from '../src/index'

const adapter = createGlassEaselWebAdapter()
expectAssignable<GlassEaselWebAdapter>(adapter)
expectType<boolean>(getGlassEaselRuntimeInfo().hasTemplateCompiler)
expectType<GlassEaselWebSnapshot>(adapter.getSnapshot({}))
