import { expectAssignable, expectType } from 'tsd'
import * as presets from '../../src/auto-import-presets'
import wevu from '../../src/auto-import-presets/wevu'
import wevuRouter from '../../src/auto-import-presets/wevu-router'

type ImportsMap = Record<string, string[]>

expectAssignable<ImportsMap>(wevu)
expectAssignable<ImportsMap>(wevuRouter)
expectType<typeof wevu>(presets.wevu)
expectType<typeof wevuRouter>(presets.wevuRouter)
