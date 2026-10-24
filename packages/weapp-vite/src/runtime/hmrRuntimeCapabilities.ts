export const HMR_RUNTIME_CAPABILITIES = [
  { id: 'script-patch', mode: 'stateful', description: '可安全接受的脚本增量' },
  { id: 'visual-assets', mode: 'stateful', description: '不改变注册和配置的模板及静态资源' },
  { id: 'stylesheet-output', mode: 'classic', description: '编译后样式字节变化，宿主未提供可靠的样式更新确认契约' },
  { id: 'config-json', mode: 'classic', description: '小程序 JSON 配置变化' },
  { id: 'entry-topology', mode: 'classic', description: '页面、组件和依赖入口拓扑变化' },
  { id: 'engine-full-reload', mode: 'classic', description: 'DevEngine 明确要求完整重载' },
  { id: 'compiler-provider', mode: 'classic', description: '编译 provider 缺少事务式 HMR 能力' },
  { id: 'runtime-contract', mode: 'classic', description: 'Vite、Rolldown 或小程序运行时能力缺失' },
  { id: 'ide-classic-handoff', mode: 'classic', description: 'IDE 缺少可确认的 classic 完整重载交接能力' },
  { id: 'native-registration', mode: 'classic', description: '原生组件注册契约发生不兼容变化' },
  { id: 'patch-shape', mode: 'classic', description: '无法安全交付的增量模块结构' },
  { id: 'platform', mode: 'classic', description: '不支持状态保持 HMR 的小程序平台' },
  { id: 'skyline', mode: 'classic', description: 'Skyline 渲染器' },
] as const

export type HmrRuntimeFallbackCode = Extract<(typeof HMR_RUNTIME_CAPABILITIES)[number], { mode: 'classic' }>['id']

export interface HmrRuntimeFallbackReason {
  code: HmrRuntimeFallbackCode
  message: string
  files?: readonly string[]
}

/** 只有明确的能力边界可以转换为 classic，普通编译和业务异常继续向上传递。 */
export class HmrRuntimeCapabilityError extends Error {
  constructor(readonly fallback: HmrRuntimeFallbackReason) {
    super(fallback.message)
    this.name = 'HmrRuntimeCapabilityError'
  }
}

export function getHmrRuntimeCapabilityFallback(error: unknown): HmrRuntimeFallbackReason | undefined {
  return error instanceof HmrRuntimeCapabilityError ? error.fallback : undefined
}

/** 仅根据最终发布资产识别样式能力边界，不由源码扩展名推测编译结果。 */
export function resolveStatefulHmrOutputFallback(options: {
  changed: readonly { fileName: string }[]
  removed?: readonly string[]
  styleExtension: string
}): HmrRuntimeFallbackReason | undefined {
  const suffix = `.${options.styleExtension.replace(/^\./, '').toLowerCase()}`
  const files = [...new Set([
    ...options.changed.map(asset => asset.fileName),
    ...(options.removed ?? []),
  ].filter(file => file.toLowerCase().endsWith(suffix)))].sort()
  if (files.length) {
    return {
      code: 'stylesheet-output',
      message: '编译后样式发生变化，当前宿主没有可靠的状态保持样式更新确认契约，需要 classic 完整发布。',
      files,
    }
  }
}

/** 在快照或增量排队前识别会改变运行时注册语义的输入。 */
export function resolveStatefulHmrInputFallback(options: {
  files: readonly string[]
  dirtyReasons?: readonly string[]
  providerSupported?: boolean
  configurationChanged?: boolean
  updateType?: string
}): HmrRuntimeFallbackReason | undefined {
  const { files, dirtyReasons = [] } = options
  if (options.providerSupported === false) {
    return { code: 'compiler-provider', message: '编译 provider 不支持事务式状态保持更新。', files }
  }
  if (dirtyReasons.some(reason => reason.startsWith('entry-graph-change') || reason.startsWith('entry-topology:'))) {
    return { code: 'entry-topology', message: '入口拓扑发生变化，需要重新建立完整构建图。', files }
  }
  if ((options.configurationChanged ?? files.some(file => /\.json(?:[?#]|$)/i.test(file)))
    || dirtyReasons.some(reason => /^(?:entry-json-only|entry-mixed-config|json-sidecar):/.test(reason))) {
    return { code: 'config-json', message: '小程序 JSON 配置发生变化，需要完整发布。', files }
  }
  if (dirtyReasons.some(reason => reason.startsWith('entry-style-bindings:'))) {
    return { code: 'patch-shape', message: '外部样式的 CSS 变量绑定发生变化，需要重新建立脚本注册。', files }
  }
  if (options.updateType === 'FullReload') {
    return { code: 'engine-full-reload', message: 'DevEngine 无法安全接受当前增量，要求完整重载。', files }
  }
}
