import { icebreaker } from '@icebreakers/eslint-config'

export default icebreaker(
  {
    miniProgram: true,
    vue: true,
    ignores: [
      'CHANGELOG.md',
      'README.md',
      '.turbo/**',
      'src/pages/category/components/goods-category/components/c-sidebar/README.md',
    ],
  },
  {
    files: ['src/**/*.{ts,vue,md}'],
    rules: {
      'no-console': 'off',
      'ts/no-use-before-define': 'off',
      'ts/no-unused-vars': 'off',
      'ts/no-redeclare': 'off',
      'ts/no-require-imports': 'off',
      'eqeqeq': 'off',
      'vue/eqeqeq': 'off',
      'vue/valid-v-for': 'off',
      'vue/no-unused-vars': 'off',
      'vue/no-use-v-if-with-v-for': 'off',
      'vue/no-parsing-error': 'off',
      'vue/no-template-shadow': 'off',
      'vue/valid-define-options': 'off',
      'style/max-statements-per-line': 'off',
      'style/no-mixed-operators': 'off',
      'prefer-promise-reject-errors': 'off',
      'regexp/no-useless-quantifier': 'off',
      'unicorn/no-new-array': 'off',
      'unicorn/prefer-number-properties': 'off',
      'jsdoc/check-param-names': 'off',
      'jsdoc/require-returns-description': 'off',
      'eslint-comments/no-unlimited-disable': 'off',
      'markdown/heading-increment': 'off',
      'no-self-assign': 'off',
    },
  },
)
