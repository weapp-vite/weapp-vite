import type { NativeDomSelection } from '@weapp-core/shared/native-dom'
import { selectNativeDom } from '@weapp-core/shared/native-dom'
import { expectError, expectType } from 'tsd'

expectType<NativeDomSelection | undefined>(selectNativeDom({ mode: 'auto', platform: 'tt' }, { __webviewId__: 1 }, 'wevu'))
expectError(selectNativeDom({ mode: 'invalid', platform: 'tt' }, {}, 'wevu'))
expectError(selectNativeDom({ mode: 'native-dom', platform: 'tt' }, { __webviewId__: '1' }, 'wevu'))
