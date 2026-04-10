import type { CompilerOptions } from 'typescript'

export interface ManagedTsconfigFile {
  path: string
  content: string
}

export interface ManagedTypeScriptConfig {
  shared?: {
    compilerOptions?: CompilerOptions
    include?: string[]
    exclude?: string[]
    files?: string[]
  }
  app?: {
    compilerOptions?: CompilerOptions
    vueCompilerOptions?: Record<string, any>
    include?: string[]
    exclude?: string[]
    files?: string[]
  }
  node?: {
    compilerOptions?: CompilerOptions
    include?: string[]
    exclude?: string[]
    files?: string[]
  }
  server?: {
    compilerOptions?: CompilerOptions
    include?: string[]
    exclude?: string[]
    files?: string[]
  }
}

export interface LegacyManagedTsconfigFile {
  compilerOptions?: CompilerOptions
  include?: string[]
  exclude?: string[]
  files?: string[]
  vueCompilerOptions?: Record<string, any>
}

export interface LegacyManagedTypeScriptConfig {
  shared?: LegacyManagedTsconfigFile
  app?: LegacyManagedTsconfigFile
  node?: LegacyManagedTsconfigFile
  server?: LegacyManagedTsconfigFile
}
