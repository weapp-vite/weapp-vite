import { buildClassStyleWxsTag, getClassStyleWxsSource } from '@wevu/compiler'
import { expectError, expectType } from 'tsd'

expectType<string>(buildClassStyleWxsTag('sjs', './helper.sjs', 'swan'))
expectType<string>(getClassStyleWxsSource({ extension: 'sjs', moduleFormat: 'commonjs' }))
expectType<string>(getClassStyleWxsSource({ extension: 'sjs', moduleFormat: 'esm' }))
expectError(getClassStyleWxsSource({ moduleFormat: 'unknown' }))
