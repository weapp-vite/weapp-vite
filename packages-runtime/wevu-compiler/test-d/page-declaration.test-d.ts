import type { CallExpression, File } from '@weapp-vite/ast/babelTypes'
import type {
  ExtractPageDeclarationWithDependenciesResult,
  StaticPageDeclaration,
  StaticRouteValue,
} from '@wevu/compiler'
import {
  collectPageMetaCallsFromPrograms,
  extractPageDeclaration,
  extractPageDeclarationWithDependencies,
  mayContainPageDeclaration,
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

expectType<StaticPageDeclaration | undefined>(
  extractPageDeclaration(`import { definePageMeta } from 'wevu'; definePageMeta({ route: { name: 'home' } })`, 'page.ts'),
)
const stripped = stripPageDeclaration(
  `import { definePageMeta } from 'wevu'; definePageMeta({ route: { name: 'home' } })`,
  'page.ts',
)
if (stripped) {
  expectType<string>(stripped.code)
  expectType<string[] | undefined>(stripped.map?.sources)
}

declare const pageMetaAst: File
expectType<CallExpression[]>(collectPageMetaCallsFromPrograms({ script: pageMetaAst, scriptSetup: pageMetaAst }))
expectType<boolean>(mayContainPageDeclaration('definePageMeta({ layout: false })'))

expectType<Promise<ExtractPageDeclarationWithDependenciesResult>>(
  extractPageDeclarationWithDependencies(
    '<script setup src="./page.ts"></script>',
    'page.vue',
  ),
)
