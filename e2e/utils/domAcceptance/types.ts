export type DomProvider = 'devtools' | 'headless'
export type DomScope = string | { has: string }
export type DomQuery = 'css' | 'xpath'
export type DomStyleExpectation = string | { rpx: number }

export interface DomNodeExpectation {
  selector: string
  query?: DomQuery
  has?: string
  scope?: DomScope[]
  count?: number
  text?: string
  attributes?: Record<string, string>
  styles?: Record<string, DomStyleExpectation>
  visible?: boolean
}

export interface DomCheckpoint {
  id: string
  route: string
  action: string
  nodes: DomNodeExpectation[]
  expectedErrors?: DomExpectedError[]
}

export interface DomExpectedError {
  source: 'build' | 'runtime'
  level: 'error' | 'exception'
  channel: string
  text: string
  count: number
}

export interface DomNodeEvidence {
  selector: string
  query: DomQuery
  has?: string
  scope?: DomScope[]
  count: number
  nodes: Array<{
    text?: string
    attributes?: Record<string, string | undefined>
    styles?: Record<string, string>
    size?: { width: number, height: number }
  }>
}

export interface DomCheckpointEvidence {
  id: string
  route: string
  source: 'devtools-page-frame' | 'headless-logical-tree'
  capturedAt: string
  windowWidth?: number
  nodes: DomNodeEvidence[]
}

export interface DomAcceptance {
  fixture: string
  provider: DomProvider
  checkpoints: DomCheckpoint[]
  evidence: DomCheckpointEvidence[]
  errorScopes?: Array<{ checkpoint: string, id: string }>
  runtime?: { ideVersion: string | null, baseLibraryVersion: string | null }
  failures?: Array<{ checkpoint: string, screenshot?: string, screenshotError?: string }>
}

export interface DomElement {
  text: () => Promise<string>
  $$?: (selector: string, options: { timeout: number }) => Promise<DomElement[]>
  outerWxml?: () => Promise<string>
  attribute?: (name: string) => Promise<string | undefined>
  attr?: (name: string) => Promise<string | undefined>
  style?: (name: string) => Promise<string>
  size?: () => Promise<{ width: number, height: number }>
}

export interface DomPage {
  readonly pageId: number
  path: string
  $$: (selector: string, options: { fallback: false, timeout: number }) => Promise<DomElement[]>
  getElementsByXpath?: (selector: string, options: { fallback: false, timeout: number }) => Promise<DomElement[]>
}

export interface DomSession {
  currentPage: (options?: { appFunctionFallback?: boolean }) => Promise<DomPage | undefined | null>
  toolInfo?: () => Promise<{ version?: string, SDKVersion?: string }>
  systemInfo?: () => Promise<{ windowWidth?: number }>
  screenshot?: (options: { path: string }) => Promise<unknown>
}
