export interface DefaultTsconfigAppJsonOptions {
  srcRoot?: string
}

function normalizeManagedSrcRoot(srcRoot: string) {
  return srcRoot === '.' ? '..' : `../${srcRoot}`
}

function normalizeSrcRoot(srcRoot: string | undefined) {
  if (!srcRoot) {
    return 'src'
  }
  if (srcRoot === '.') {
    return '.'
  }
  return srcRoot.replaceAll('\\', '/').replace(/\/+$/u, '')
}

function createSrcIncludeGlobs(srcRoot: string) {
  const managedSrcRoot = normalizeManagedSrcRoot(srcRoot)
  const prefix = `${managedSrcRoot}/**`
  return [
    `${prefix}/*.ts`,
    `${prefix}/*.tsx`,
    `${prefix}/*.js`,
    `${prefix}/*.jsx`,
    `${prefix}/*.mts`,
    `${prefix}/*.cts`,
    `${prefix}/*.vue`,
    `${prefix}/*.json`,
    `${prefix}/*.d.ts`,
  ]
}

const extraIncludeGlobs = [
  '../types/**/*.d.ts',
  '../env.d.ts',
  './**/*.d.ts',
]

/**
 * @description 生成默认 tsconfig.json
 */
export function getDefaultTsconfigJson() {
  return {
    references: [
      {
        path: './.weapp-vite/tsconfig.app.json',
      },
      {
        path: './.weapp-vite/tsconfig.server.json',
      },
      {
        path: './.weapp-vite/tsconfig.node.json',
      },
      {
        path: './.weapp-vite/tsconfig.shared.json',
      },
    ],
    files: [],
  }
}

/**
 * @description 生成默认 tsconfig.app.json
 */
export function getDefaultTsconfigAppJson(options: DefaultTsconfigAppJsonOptions = {}) {
  const srcRoot = normalizeSrcRoot(options.srcRoot)
  return {
    extends: './tsconfig.shared.json',
    compilerOptions: {
      tsBuildInfoFile: '../node_modules/.tmp/tsconfig.app.tsbuildinfo',
      target: 'ES2023',
      lib: [
        'ES2023',
        'DOM',
      ],
      jsx: 'preserve',
      module: 'ESNext',
      moduleResolution: 'bundler',
      moduleDetection: 'force',
      paths: {
        '@/*': [
          `${normalizeManagedSrcRoot(srcRoot)}/*`,
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
    include: [
      ...createSrcIncludeGlobs(srcRoot),
      ...extraIncludeGlobs,
    ],
  }
}

/**
 * @description 生成默认 tsconfig.shared.json
 */
export function getDefaultTsconfigSharedJson() {
  return {
    compilerOptions: {
      target: 'ES2023',
      module: 'ESNext',
      moduleResolution: 'bundler',
      moduleDetection: 'force',
      resolveJsonModule: true,
      allowImportingTsExtensions: true,
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
    files: ['./tsconfig.shared.empty.d.ts'],
  }
}

/**
 * @description 生成默认 tsconfig.node.json
 */
export function getDefaultTsconfigNodeJson(include: string[] = []) {
  const baseInclude = [
    '../vite.config.ts',
    '../vite.config.*.ts',
    '../vite.config.mts',
    '../vite.config.*.mts',
    '../weapp-vite.config.ts',
    '../weapp-vite.config.*.ts',
    '../weapp-vite.config.mts',
    '../weapp-vite.config.*.mts',
    '../*.config.ts',
    '../*.config.mts',
    '../config/**/*.ts',
    '../config/**/*.mts',
    '../scripts/**/*.ts',
    '../scripts/**/*.mts',
  ]

  const mergedInclude = [...new Set([
    ...baseInclude,
    ...include,
  ])]

  return {
    extends: './tsconfig.shared.json',
    compilerOptions: {
      tsBuildInfoFile: '../node_modules/.tmp/tsconfig.node.tsbuildinfo',
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

/**
 * @description 生成默认 tsconfig.server.json
 */
export function getDefaultTsconfigServerJson() {
  return {
    extends: './tsconfig.shared.json',
    compilerOptions: {
      tsBuildInfoFile: '../node_modules/.tmp/tsconfig.server.tsbuildinfo',
      target: 'ES2023',
      lib: [
        'ES2023',
      ],
      types: [
        'node',
      ],
    },
    files: [],
  }
}
