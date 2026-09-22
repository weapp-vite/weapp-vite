import { expectError, expectType } from 'tsd'
import { definePageMeta } from 'wevu'
import * as router from 'wevu/router'

declare const dynamicTitle: string
declare const transformLayoutValue: (value: string) => string

expectType<void>(definePageMeta({ layout: false }))

expectType<void>(definePageMeta({
  layout: {
    name: 'dashboard',
    props: {
      title: dynamicTitle,
      transform: transformLayoutValue,
    },
  },
  route: {
    name: 'home',
    meta: {
      title: 'Home',
      requiresAuth: false,
      priority: 1,
      parent: null,
      tags: ['root', null],
      transition: {
        name: 'fade',
      },
    },
  },
} as const))

expectError(definePageMeta({
  route: {
    name: 'invalid-undefined',
    meta: {
      value: undefined,
    },
  },
}))

expectError(definePageMeta({
  route: {
    name: 'invalid-function',
    meta: {
      handler: transformLayoutValue,
    },
  },
}))

expectError(definePageMeta({
  route: {
    name: 'invalid-meta',
    meta: null,
  },
}))

expectType<void>(definePageMeta({
  name: '',
  meta: {
    value: undefined,
    handler: transformLayoutValue,
  },
}))

expectError(router.definePage)
