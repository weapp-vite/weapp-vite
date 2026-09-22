import type { CallExpression, File } from '@weapp-vite/ast/babelTypes'
import type {
  ExtractPageDeclarationWithDependenciesResult,
  StaticPageDeclaration as RootStaticPageDeclaration,
} from '@wevu/compiler'
import type { StaticPageDeclaration, StaticRouteValue } from '@wevu/compiler/page-route'
import {
  collectPageMetaCallsFromPrograms,
  extractPageDeclaration,
  extractPageDeclarationWithDependencies,
  mayContainPageDeclaration,
  mayContainPageMeta,
  stripPageDeclaration,
} from '@wevu/compiler'
import { expectAssignable, expectNotAssignable, expectType } from 'tsd'

expectAssignable<StaticRouteValue>(null)
expectAssignable<StaticRouteValue>(['title', false, 1, { nested: null }])
expectAssignable<StaticRouteValue>({ __proto__: { safe: true } })
expectNotAssignable<StaticRouteValue>(undefined)
expectNotAssignable<StaticRouteValue>({ invalid: undefined })
expectNotAssignable<StaticRouteValue>(() => 'dynamic')

expectAssignable<StaticPageDeclaration>({ name: 'home' })
expectAssignable<StaticPageDeclaration>({
  name: 'profile',
  meta: {
    requiresAuth: true,
    badges: ['verified', 1],
  },
})
expectNotAssignable<StaticPageDeclaration>({ name: 'invalid', meta: null })

expectType<RootStaticPageDeclaration | undefined>(
  extractPageDeclaration(`import { definePage } from 'wevu/router'; definePage({ name: 'home' })`, 'page.ts'),
)
const stripped = stripPageDeclaration(
  `import { definePage } from 'wevu/router'; definePage({ name: 'home' })`,
  'page.ts',
)
if (stripped) {
  expectType<string>(stripped.code)
  expectType<string[] | undefined>(stripped.map?.sources)
}

declare const pageMetaAst: File
expectType<CallExpression[]>(collectPageMetaCallsFromPrograms({ script: pageMetaAst, scriptSetup: pageMetaAst }))
expectType<boolean>(mayContainPageDeclaration('definePage({ name: \'home\' })'))
expectType<boolean>(mayContainPageMeta('definePageMeta({ layout: false })'))

expectType<Promise<ExtractPageDeclarationWithDependenciesResult>>(
  extractPageDeclarationWithDependencies(
    '<script setup src="./page.ts"></script>',
    'page.vue',
  ),
)
