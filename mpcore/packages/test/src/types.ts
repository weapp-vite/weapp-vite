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
  /** 从首次挂载开始收集指定事件，无需提供回调。 */
  events?: string[]
  on?: Record<string, MiniProgramEventListener>
  properties?: Record<string, unknown>
  slots?: Record<string, string>
  /** 递归替换本次渲染的组件别名；字符串路径相对于小程序产物根目录。 */
  usingComponents?: Record<string, string | InlineComponentStub>
}

export type MiniProgramEventListener = (detail: unknown, event: Record<string, any>) => void

/** 声明式子组件替身；properties 的值为默认属性值。 */
export interface InlineComponentStub {
  data?: Record<string, unknown>
  properties?: Record<string, unknown>
  template?: string
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

export interface MiniProgramComponentRenderResult extends MiniProgramRenderResult {
  /** 移除当前事件的全部订阅，或移除指定回调的全部订阅。 */
  off: (eventName: string, listener?: MiniProgramEventListener) => void
  /** 每次调用建立独立订阅；返回值仅取消本次订阅，省略回调时只收集事件。 */
  on: (eventName: string, listener?: MiniProgramEventListener) => () => void
  /** 更新当前组件实例的数据，并等待渲染完成。 */
  setData: (data: Record<string, unknown>) => Promise<void>
  /** 通过宿主绑定更新当前组件的属性，并等待渲染完成。 */
  setProperties: (properties: Record<string, unknown>) => Promise<void>
  /** 移除组件主体并触发真实卸载流程，保留可独立关闭的测试会话。 */
  unmount: () => Promise<void>
}

export interface MiniProgramMatcherResult {
  message: () => string
  pass: boolean
}

export type MiniProgramNodeLike = MiniProgramNode
