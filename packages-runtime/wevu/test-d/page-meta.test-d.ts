import { expectError, expectType } from 'tsd'
import { definePageMeta } from 'wevu'
import {
  definePage as declarePage,
  definePage,
} from 'wevu/router'
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
  custom: {
    title: dynamicTitle,
    transform: transformLayoutValue,
  },
}))

expectType<void>(definePage({
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
} as const))

expectType<void>(declarePage({
  name: 'profile',
}))

expectError(definePage({
  name: 'invalid-undefined',
  meta: {
    value: undefined,
  },
}))

expectError(definePage({
  name: 'invalid-function',
  meta: {
    handler: transformLayoutValue,
  },
}))

expectError(definePage({
  name: 'invalid-meta',
  meta: null,
}))

expectError(definePage({
  name: 'invalid-layout',
  layout: false,
}))

expectError(definePage({
  name: 'invalid-path',
  path: '/pages/invalid/index',
}))

expectError(router.definePageRoute)
