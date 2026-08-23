import tsParser from '@typescript-eslint/parser'
import { RuleTester } from 'eslint'
import { describe } from 'vitest'
import vueParser from 'vue-eslint-parser'
import { wevuCompatibilityPlugin } from './index'

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
