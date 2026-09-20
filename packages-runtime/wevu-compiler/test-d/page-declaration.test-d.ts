import type {
  ExtractPageDeclarationWithDependenciesResult,
  StaticPageDeclaration,
  StaticRouteValue,
} from '@wevu/compiler'
import {
  extractPageDeclaration,
  extractPageDeclarationWithDependencies,
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

expectType<Promise<ExtractPageDeclarationWithDependenciesResult>>(
  extractPageDeclarationWithDependencies(
    '<script setup src="./page.ts"></script>',
    'page.vue',
  ),
)
