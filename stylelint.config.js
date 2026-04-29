import { icebreaker } from '@icebreakers/stylelint-config'

const appLikeStyleFiles = [
  'apps/**/*.{css,scss,less,wxss,vue}',
  'assets/**/*.{css,scss,less,wxss,vue}',
  'packages/weapp-vite/test/fixtures/**/*.{css,scss,less,wxss,vue}',
  'templates/**/*.{css,scss,less,wxss,vue}',
  'test/fixture-projects/**/*.{css,scss,less,wxss,vue}',
]

export default icebreaker({
  miniProgram: true,
  ignoreFiles: [
    '**/node_modules/**',
    '**/dist/**',
    '**/dist-*/**',
    '**/dist-plugin/**',
    '**/dist-web/**',
    '**/build/**',
    '**/coverage/**',
    '**/miniprogram_npm/**',
    '**/.vite/**',
    '**/.vite-inspect/**',
    '**/.turbo/**',
    '**/.cache/**',
    '**/__temp__/**',
    '**/.tmp/**',
    '**/.weapp-vite/**',
    '**/.wevu-config/**',
    'docs/reports/**',
    'e2e-apps/__temp__/**/*',
    'test/fixture-projects/weapp-vite/subPackages-shared-styles/src/packageA/styles/components.less',
  ],
  rules: {
    'tailwindcss/no-atomic-class': null,
    'unocss/no-atomic-class': null,
  },
  overrides: [
    {
      files: ['**/*.scss'],
      customSyntax: 'postcss-scss',
      rules: {
        'at-rule-no-unknown': null,
        'scss/at-rule-no-unknown': [true, {
          ignoreAtRules: ['config', 'tailwind', 'wv-keep-import'],
        }],
      },
    },
    {
      files: ['templates/**/*.scss'],
      rules: {
        'at-rule-no-unknown': null,
      },
    },
    {
      files: ['**/*.wxss'],
      rules: {
        'selector-type-no-unknown': null,
      },
    },
    {
      files: appLikeStyleFiles,
      rules: {
        'no-empty-source': null,
      },
    },
    {
      files: ['apps/tdesign-miniprogram-starter-retail/**/*.{wxss,scss,vue}'],
      rules: {
        'declaration-block-no-duplicate-properties': null,
        'declaration-property-value-keyword-no-deprecated': null,
        'font-family-no-missing-generic-family-keyword': null,
        'property-no-deprecated': null,
        'selector-class-pattern': null,
      },
    },
    {
      files: [
        'apps/vite-native-skyline/components/navigation-bar/navigation-bar.wxss',
        'apps/vite-native-ts-skyline/miniprogram/components/Navbar/Navbar.wxss',
      ],
      rules: {
        'custom-property-pattern': null,
        'selector-class-pattern': null,
      },
    },
  ],
})
