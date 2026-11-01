import type { I18nInstance } from '@weapp-vite/i18n'
import process from 'node:process'
import { expectType } from 'tsd'
import { behavior, i18n, page } from 'weapp-vite/i18n'

expectType<I18nInstance>(i18n)
expectType<I18nInstance['behavior']>(behavior)
expectType<I18nInstance['page']>(page)

page({
  data: { count: 0 },
  onLoad() {
    expectType<number>(this.data.count)
  },
})

expectType<Document>(document)
expectType<NodeJS.Process>(process)
// @ts-expect-error 公开声明不得注入微信运行时全局。
void wx
// @ts-expect-error 公开声明不得注入 Page 全局。
void Page
// @ts-expect-error 公开声明不得注入 Behavior 全局。
void Behavior
