import type {
  AppHideCallback,
  AppHideOptions,
  AppLaunchOptions,
  AppShowCallback,
} from '@weapp-vite/web'
import {
  offAppHide,
  offAppShow,
  onAppHide,
  onAppShow,
} from '@weapp-vite/web'
import { expectError, expectType } from 'tsd'

const showCallback: AppShowCallback = (options) => {
  expectType<AppLaunchOptions>(options)
}
const hideCallback: AppHideCallback = (options) => {
  expectType<AppHideOptions>(options)
  expectType<0 | 1 | 2 | 3>(options.reason)
}

expectType<void>(onAppShow(showCallback))
expectType<void>(offAppShow(showCallback))
expectType<void>(offAppShow())
expectType<void>(onAppHide(hideCallback))
expectType<void>(offAppHide(hideCallback))
expectType<void>(offAppHide())
expectError(onAppShow())
expectError(onAppHide())
