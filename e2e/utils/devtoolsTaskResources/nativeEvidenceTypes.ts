import type { DarwinFrameAbsoluteEvidence, DarwinProcessAbsoluteEvidence } from './processInventory/darwinInspector/types'
import type { NativeImageEvidence, ProcessIdentityGapObservation, ProcessIdentityMetadata } from './types'

export interface NativeConfirmationEvidence {
  absolute: DarwinProcessAbsoluteEvidence
  before: ProcessIdentityMetadata | null
  after: ProcessIdentityMetadata | null
  beforeQuery: { result: number, length: number, errno: number }
  afterQuery: { result: number, length: number, errno: number }
  pathBefore: { count: number, errno: number, image: NativeImageEvidence | null }
  pathAfter: { count: number, errno: number, image: NativeImageEvidence | null }
  credentialsStable: boolean
}

export interface NativeAbsoluteFrameEvidence {
  absolute?: DarwinFrameAbsoluteEvidence
}

export interface NativeAbsoluteRowEvidence {
  absolute?: DarwinProcessAbsoluteEvidence
  confirmation?: NativeConfirmationEvidence | null
  credentials: { mainStable: boolean, enumerationMatchesMain: boolean }
}

export interface VerifiedPostAnchorForeignProcess {
  process: ProcessIdentityGapObservation
  proof: 'mach-birth-after-entire-anchor-and-complete-foreign-confirmation'
  clockDomain: 'mach-absolute-ticks'
  birthTicks: string
  anchorEndedAtTicks: string
  phases: Array<'closure1' | 'closure2'>
  confirmationPhase: 'closure2'
  enumerationCredentialsChanged: boolean
  ancestry: ProcessIdentityMetadata[]
  image: NativeImageEvidence
  semantics: 'closure-ownership-only; no-preparation-or-closure-rss-counted'
}
