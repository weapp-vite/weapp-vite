import type {
  HeadlessTestingPageHandle,
  HeadlessWxActionSheetMockDefinition,
  HeadlessWxDownloadFileMockDefinition,
  HeadlessWxModalMockDefinition,
  HeadlessWxRequestMockDefinition,
  HeadlessWxUploadFileMockDefinition,
  PlatformAdapter,
  RuntimeDiagnosticEntry,
} from '@mpcore/simulator'
import type { MiniProgramNode, MiniProgramScreen } from './screen'
import type { MiniProgramUser } from './user'

export interface MiniProgramArtifact {
  appConfigPath?: string
  miniprogramRootPath?: string
  projectPath: string
}

export interface WxHostMock {
  actionSheet?: HeadlessWxActionSheetMockDefinition | HeadlessWxActionSheetMockDefinition[]
  downloadFile?: HeadlessWxDownloadFileMockDefinition | HeadlessWxDownloadFileMockDefinition[]
  modal?: HeadlessWxModalMockDefinition | HeadlessWxModalMockDefinition[]
  request?: HeadlessWxRequestMockDefinition | HeadlessWxRequestMockDefinition[]
  uploadFile?: HeadlessWxUploadFileMockDefinition | HeadlessWxUploadFileMockDefinition[]
}

export interface CreateTestProjectOptions {
  artifact: MiniProgramArtifact
  failOnConsoleError?: boolean
  host?: WxHostMock
  platform?: PlatformAdapter
}

export interface RenderComponentOptions {
  on?: Record<string, (detail: unknown, event: Record<string, any>) => void>
  properties?: Record<string, unknown>
  slots?: Record<string, string>
}

export interface MiniProgramRenderResult {
  close: () => Promise<void>
  diagnostics: () => RuntimeDiagnosticEntry[]
  emitted: (eventName: string) => unknown[]
  page: HeadlessTestingPageHandle
  screen: MiniProgramScreen
  user: MiniProgramUser
}

export interface MiniProgramEmissionSource {
  emitted: (eventName: string) => unknown[]
}

export interface MiniProgramMatcherResult {
  message: () => string
  pass: boolean
}

export type MiniProgramNodeLike = MiniProgramNode
