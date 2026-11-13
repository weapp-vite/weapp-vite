import type { ComponentOptions } from '@vue/runtime-core'
import type { NativeComponentConfig } from 'wevu/native-dom'
import { expectAssignable, expectError, expectType } from 'tsd'
import { h, withNativeDom } from 'wevu/native-dom'

expectAssignable<NativeComponentConfig>({ mode: 'auto', platform: 'tt', isPage: true })
expectError(withNativeDom({}, () => h('view'), { mode: 'invalid', platform: 'tt', isPage: true }))
expectType<ComponentOptions>(withNativeDom({}, () => h('view'), { mode: 'native-dom', platform: 'tt', isPage: false }))
