import type { CorpusFileIdentity, CorpusGeneration } from '../types'

export type FrameworkFamily = 'uni-vue2' | 'uni-vue3' | 'mpx' | 'taro' | 'ant-design-mini'
export type GenerationMode = 'development' | 'production'

export interface FrameworkTarget {
  target: string
  platform: string
  profileId: string
  extensions: string[]
  container?: 'template'
  support: 'candidate' | 'unsupported'
  evidence: string
}

export interface FrameworkRelease {
  framework: FrameworkFamily
  version: string
  compiler: string
  upstream?: { repository: string, commit: string }
  targets: FrameworkTarget[]
}

export interface GenerationIdentity {
  repository: string
  commit: string
  licenseId: string
}

export interface GenerationOptions {
  framework: FrameworkFamily
  version: string
  target: string
  workspace: string
  input: string
  identity: GenerationIdentity
  inputDependencies?: Record<string, string>
  controlledFixtureId?: string
  modes?: GenerationMode[]
  execute?: boolean
  retry?: boolean
}

export interface ControlledProject {
  dependencies: Record<string, string>
  files: Record<string, string>
  command: string[]
  environment: Record<string, string>
}

export interface GenerationEvidence {
  schemaVersion: 1
  id: string
  framework: FrameworkFamily
  version: string
  target: string
  mode: GenerationMode
  source: GenerationIdentity
  inputDependencies: Record<string, string>
  provenance?: { kind: 'controlled-fixture', fixtureId: string, quotaEligible: false }
  runtime: { node: string, packageManager: string }
  input: CorpusFileIdentity[]
  configuration: CorpusFileIdentity[]
  dependencies: CorpusFileIdentity[]
  outputs: CorpusFileIdentity[]
  nonTemplateOutputs?: Array<{ original: CorpusFileIdentity, reason: 'no-explicit-template' }>
  logs: CorpusFileIdentity[]
  commands: string[][]
  status: CorpusGeneration['status']
  reason?: string
}
