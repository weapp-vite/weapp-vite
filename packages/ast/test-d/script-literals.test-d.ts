import {
  collectScriptCallStringLiterals,
  collectScriptStringLiterals,
  mayContainScriptCallOrModuleSyntax,
} from '@weapp-vite/ast'
import { expectType } from 'tsd'

expectType<string[]>(collectScriptStringLiterals(`const value = 'card'`))
expectType<string[]>(collectScriptCallStringLiterals(`createClass('card')`))
expectType<boolean>(mayContainScriptCallOrModuleSyntax(`createClass('card')`))
