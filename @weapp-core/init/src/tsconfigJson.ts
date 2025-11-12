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

export function getDefaultTsconfigJson() {
  return {
    references: [
      {
        path: './tsconfig.app.json',
      },
      {
        path: './tsconfig.node.json',
      },
      {
        path: './tsconfig.test.json',
      },
    ],
    files: [],
  }
}

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
        'take:@/*': [
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

export function getDefaultTsconfigTestJson() {
  return {
    extends: './tsconfig.app.json',
    compilerOptions: {
      tsBuildInfoFile: './node_modules/.tmp/tsconfig.test.tsbuildinfo',
      types: [
        'miniprogram-api-typings',
        'vitest/globals',
      ],
      noEmit: true,
    },
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'src/**/*.test.mts',
      'src/**/*.test.cts',
      'src/**/*.spec.ts',
      'src/**/*.spec.tsx',
      'src/**/*.spec.mts',
      'src/**/*.spec.cts',
      'tests/**/*.ts',
      'tests/**/*.tsx',
      'tests/**/*.mts',
      'tests/**/*.cts',
    ],
  }
}
