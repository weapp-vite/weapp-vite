export const SAMPLING_CONTRACT = 'wxml-paired-v4-full-real-wxml-gates'
export const PARSING_CONTRACT = Object.freeze({
  syntax: 'xml',
  parseEntities: 'raw',
  parseRanges: 'utf16-half-open-common-nodes',
  scanAttributes: 'decoded',
  canonicalTrees: 'native-representation',
  editTextSelector: 'first-nonblank-original-source-text-excluding-cdata',
} as const)
export const CORE_OPERATIONS = ['scan', 'parse', 'canonical', 'parse-edit-serialize', 'preserve-noop'] as const
export const FEATURE_COHORTS = ['attributes-dense', 'interpolation', 'entities', 'script', 'web'] as const
export const PERFORMANCE_CONTRACT = Object.freeze({
  aggregateCohorts: ['shared', 'real-all'] as const,
  aggregateMaximumRegressionPercent: 0,
  categoryMaximumRegressionPercent: 5,
  informationalOperations: ['preserve-noop'] as const,
})
export type Feature = typeof FEATURE_COHORTS[number]

export interface WorkloadManifest {
  contract: typeof SAMPLING_CONTRACT
  parsing: typeof PARSING_CONTRACT
  performance: typeof PERFORMANCE_CONTRACT
  rounds: number
  warmup: number
  operations: Array<{ id: string, comparable: boolean }>
  fixtures: Array<{ id: string, sha256: string, bytes: number, cohort: 'shared' | 'wxml', synthetic: boolean }>
  cohorts: Array<{ id: string, fixtureIds: string[], documents: number, bytes: number }>
}
