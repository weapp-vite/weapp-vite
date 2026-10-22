import type { CustomElement } from '@weapp-vite/miniprogram-automator'
import { expectError, expectType } from 'tsd'

declare const component: CustomElement

expectType<Promise<any>>(component.callMethod('mark', 'component-method'))
expectType<Promise<any>>(component.callMethod('completeWithoutValue'))
expectType<Promise<any>>(component.callMethod('completeAsync', 'async-method'))
expectError(component.callMethod(1))
