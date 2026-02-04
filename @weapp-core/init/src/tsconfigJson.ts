const srcIncludeGlobs = [
  'src/**/*.ts',
  'src/**/*.tsx',
  'src/**/*.js',
  'src/**/*.jsx',
  'src/**/*.mts',
  'src/**/*.cts',
  'src/**/*.vue',
  'src/**/*.json',
  'src/**/*.d.ts',
  'types/**/*.d.ts',
  'env.d.ts',
]

/**
 * @description 生成默认 tsconfig.json
 */
export function getDefaultTsconfigJson() {
  return {
    references: [
      {
        path: './tsconfig.app.json',
      },
      {
        path: './tsconfig.node.json',
      },
    ],
    files: [],
  }
}

/**
 * @description 生成默认 tsconfig.app.json
 */
export function getDefaultTsconfigAppJson() {
  return {
    compilerOptions: {
      tsBuildInfoFile: './node_modules/.tmp/tsconfig.app.tsbuildinfo',
      target: 'ES2023',
      lib: [
        'ES2023',
        'DOM',
        'DOM.Iterable',
      ],
      jsx: 'preserve',
      module: 'ESNext',
      moduleResolution: 'bundler',
      moduleDetection: 'force',
      baseUrl: '.',
      paths: {
        '@/*': [
          './src/*',
        ],
      },
      resolveJsonModule: true,
      types: [
        'miniprogram-api-typings',
      ],
      allowImportingTsExtensions: true,
      allowJs: true,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      isolatedModules: true,
      strict: true,
      noFallthroughCasesInSwitch: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noEmit: true,
      verbatimModuleSyntax: true,
      noUncheckedSideEffectImports: true,
      erasableSyntaxOnly: true,
      skipLibCheck: true,
    },
    include: srcIncludeGlobs,
  }
}

/**
 * @description 生成默认 tsconfig.node.json
 */
export function getDefaultTsconfigNodeJson(include: string[] = []) {
  const baseInclude = [
    'vite.config.ts',
    'vite.config.*.ts',
    '*.config.ts',
    'config/**/*.ts',
    'scripts/**/*.ts',
  ]

  const mergedInclude = Array.from(new Set([
    ...baseInclude,
    ...include,
  ]))

  return {
    compilerOptions: {
      tsBuildInfoFile: './node_modules/.tmp/tsconfig.node.tsbuildinfo',
      target: 'ES2023',
      lib: [
        'ES2023',
      ],
      module: 'ESNext',
      moduleResolution: 'bundler',
      moduleDetection: 'force',
      types: [
        'node',
      ],
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      verbatimModuleSyntax: true,
      strict: true,
      noFallthroughCasesInSwitch: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noEmit: true,
      noUncheckedSideEffectImports: true,
      erasableSyntaxOnly: true,
      skipLibCheck: true,
    },
    include: mergedInclude,
  }
}
