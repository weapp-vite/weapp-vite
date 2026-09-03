import tsParser from '@typescript-eslint/parser'
import { ESLint, RuleTester } from 'eslint'
import { describe, expect, it } from 'vitest'
import vueParser from 'vue-eslint-parser'
import {
  createMiniProgramRuntimeConfig,
  miniProgramRuntimePlugin,
  wevuCompatibilityPlugin,
} from './index'

const unsupportedRule = wevuCompatibilityPlugin.rules['no-unsupported-api']
const riskyRule = wevuCompatibilityPlugin.rules['no-risky-api']
const templateRule = wevuCompatibilityPlugin.rules['no-unsupported-template-feature']

describe('wevu compatibility ESLint rules', () => {
  const tester = new RuleTester({
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsParser,
    },
  })

  tester.run('wevu/no-unsupported-api', unsupportedRule, {
    valid: [
      `import { ref } from 'vue'`,
      `import type { RouterLink } from 'vue-router'`,
      `import { RouterLink } from './components/RouterLink'`,
    ],
    invalid: [
      {
        code: `import { createPinia as createManager } from 'pinia'`,
        errors: [{ message: /createPinia.*createStore/ }],
      },
      {
        code: `import * as Router from 'vue-router'; Router.createWebHistory()`,
        errors: [{ message: /createWebHistory.*createRouter/ }],
      },
    ],
  })

  tester.run('wevu/no-risky-api', riskyRule, {
    valid: [`import { ref } from 'vue'`],
    invalid: [
      {
        code: `import type { ComponentPublicInstance as Instance } from 'vue'`,
        errors: [{ message: /ComponentPublicInstance.*语义不同/ }],
      },
      {
        code: `import * as Pinia from 'pinia'; type Refs = typeof Pinia.storeToRefs`,
        errors: [{ message: /storeToRefs.*语义不同/ }],
      },
    ],
  })

  const vueTester = new RuleTester({
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: vueParser,
      parserOptions: { parser: tsParser },
    },
  })
  vueTester.run('wevu/no-unsupported-template-feature', templateRule, {
    valid: [
      `<script setup>import RouterLink from './RouterLink.vue'</script><template><RouterLink /></template>`,
      `<template><router-link /></template>`,
    ],
    invalid: [
      {
        filename: 'page.vue',
        code: `<script setup>import { RouterLink } from 'vue-router'</script><template><RouterLink to="/" /></template>`,
        errors: [{ message: /router-link.*router\.push/ }],
      },
      {
        filename: 'page.vue',
        code: `<script setup>import { RouterLink as AppLink } from 'vue-router'</script><template><app-link /></template>`,
        errors: [{ message: /router-link.*router\.push/ }],
      },
    ],
  })
})

describe('mini-program runtime ESLint rules', () => {
  const tester = new RuleTester({
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsParser,
    },
  })

  tester.run(
    'mini-program/no-unsupported-runtime-api',
    miniProgramRuntimePlugin.rules['no-unsupported-runtime-api'],
    {
      valid: [
        `const window = {}; window.open()`,
        `function render(document: object) { return document }`,
        `import Buffer from './buffer'; Buffer.from('x')`,
        `typeof window`,
        `typeof globalThis.process`,
        `typeof Object.fromEntries`,
        `type Runtime = typeof window`,
        `type FromEntries = typeof Object.fromEntries`,
      ],
      invalid: [
        { code: `window.open()`, errors: [{ message: /window.*不是受支持/ }] },
        { code: `globalThis['process'].env`, errors: [{ message: /process.*不是受支持/ }] },
        { code: `Object.fromEntries(entries)`, errors: [{ message: /Object\.fromEntries.*for\.\.\.of/ }] },
        { code: `globalThis.Object.fromEntries(entries)`, errors: [{ message: /Object\.fromEntries.*for\.\.\.of/ }] },
        { code: `Promise.allSettled(tasks)`, errors: [{ message: /Promise\.allSettled/ }] },
        { code: `items.flatMap(read)`, errors: [{ message: /Array\.prototype\.flatMap/ }] },
        { code: `value.replaceAll(':', '-')`, errors: [{ message: /String\.prototype\.replaceAll/ }] },
      ],
    },
  )

  tester.run(
    'mini-program/no-implicit-runtime-polyfill',
    miniProgramRuntimePlugin.rules['no-implicit-runtime-polyfill'],
    {
      valid: [
        `const queueMicrotask = callback => Promise.resolve().then(callback); queueMicrotask(run)`,
        `function request(fetch: Function) { return fetch('/') }`,
        `import { URL } from '@wevu/web-apis'; new URL('/')`,
        `typeof queueMicrotask`,
        `typeof globalThis.fetch`,
      ],
      invalid: [
        { code: `queueMicrotask(run)`, errors: [{ message: /queueMicrotask.*appPrelude\.webRuntime/ }] },
        { code: `globalThis.fetch('/')`, errors: [{ message: /fetch.*appPrelude\.webRuntime/ }] },
        { code: `new AbortController()`, errors: [{ message: /AbortController.*appPrelude\.webRuntime/ }] },
        { code: `new CustomEvent('ready')`, errors: [{ message: /CustomEvent.*appPrelude\.webRuntime/ }] },
      ],
    },
  )

  it('limits the default flat config to mini-program src files', async () => {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [createMiniProgramRuntimeConfig()],
    })
    const [runtimeResult] = await eslint.lintText('queueMicrotask(run)', { filePath: 'src/page.js' })
    const [configResult] = await eslint.lintText('queueMicrotask(run)', { filePath: 'vite.config.js' })
    const [testResult] = await eslint.lintText('queueMicrotask(run)', { filePath: 'src/page.test.js' })

    expect(runtimeResult?.messages).toEqual([
      expect.objectContaining({
        ruleId: 'mini-program/no-implicit-runtime-polyfill',
        severity: 1,
      }),
    ])
    expect(configResult?.messages).toHaveLength(0)
    expect(testResult?.messages).toHaveLength(0)
  })
})
