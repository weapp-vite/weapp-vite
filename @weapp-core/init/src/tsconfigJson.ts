export function getDefaultTsconfigJson() {
  return {
    compilerOptions: {
      target: 'ES2020',
      jsx: 'preserve',
      lib: [
        'ES2020',
        'DOM',
        'DOM.Iterable',
      ],
      useDefineForClassFields: true,
      baseUrl: '.',
      module: 'ESNext',
      moduleResolution: 'bundler',
      paths: {
        '@/*': [
          './*',
        ],
      },
      resolveJsonModule: true,
      types: [
        'miniprogram-api-typings',
      ],
      allowImportingTsExtensions: true,
      allowJs: true,
      strict: true,
      noFallthroughCasesInSwitch: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noEmit: true,
      isolatedModules: true,
      skipLibCheck: true,
    },
    references: [
      {
        path: './tsconfig.node.json',
      },
    ],
    include: [
      '**/*.ts',
      '**/*.js',
    ],
    exclude: [
      'node_modules',
      'dist',
    ],
  }
}

export function getDefaultTsconfigNodeJson(include: string[]) {
  return {
    compilerOptions: {
      composite: true,
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      allowSyntheticDefaultImports: true,
      skipLibCheck: true,
    },
    include,
  }
}