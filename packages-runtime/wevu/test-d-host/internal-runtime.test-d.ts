import { expectType } from 'tsd'
import { installJsxIslands, useSelectorQuery } from 'wevu/internal-runtime'

expectType<void>(installJsxIslands())
expectType<WechatMiniprogram.SelectorQuery | null>(useSelectorQuery()())
