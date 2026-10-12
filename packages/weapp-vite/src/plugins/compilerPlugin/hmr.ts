import type { CompilerContext } from '../../context'
import type { CompilerRawBinding, CompilerRawRead } from './rawInputs'
import path from 'node:path'
import { HmrCompilerHost } from '@weapp-vite/hmr'
import { resolveVueSfcHmrSignatures } from 'wevu/compiler'
import { resolveRealpath, withRealpathScope } from '../../utils/realpathScope'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { captureCompilerRawBinding } from './rawInputs'

export { CompilerHmrResyncError } from '@weapp-vite/hmr'

const hosts = new WeakMap<CompilerContext, CompilerHmrHost>()
const hostsByConfig = new WeakMap<object, CompilerHmrHost>()
const rawSnapshots = new WeakMap<ReadonlyMap<string, string | null>, {
  files: ReadonlySet<string>
  changedFiles: readonly string[]
  reads: ReadonlyMap<string, CompilerRawRead>
  bindings: ReadonlyMap<string, CompilerRawBinding>
}>()

/** raw 身份与冻结 Map 同步绑定，不从后续活动宿主推断旧批次的输入归属。 */
export function getCompilerRawSnapshot(sources: ReadonlyMap<string, string | null>) {
  return rawSnapshots.get(sources)
}

/** 统一扫描器与模块图中的符号链接身份，删除事件沿用父目录的真实路径。 */
export function compilerSourceId(id: string): string {
  if (!path.isAbsolute(id) && path.win32.isAbsolute(id)) {
    return normalizeFsResolvedId(id)
  }
  try {
    return normalizeFsResolvedId(resolveRealpath(id))
  }
  catch {
    try {
      return normalizeFsResolvedId(path.join(resolveRealpath(path.dirname(id)), path.basename(id)))
    }
    catch {
      return normalizeFsResolvedId(id)
    }
  }
}

export class CompilerHmrHost extends HmrCompilerHost {
  private readonly rawInputs = new Set<string>()
  private readonly moduleInputs = new Set<string>()
  private readonly seededInputs = new Set<string>()
  private readonly rawReads = new Map<string, CompilerRawRead>()
  private readonly rawBindings = new Map<string, CompilerRawBinding>()
  private nativeInputIds = new Set<string>()

  private rememberRawBinding(id: string, sourceId: string): void {
    const lexical = normalizeFsResolvedId(id)
    this.rawBindings.set(lexical, captureCompilerRawBinding(id, sourceId))
    if (lexical !== sourceId) {
      // alias 后续改指不能撤销已观察的 physical 输入；canonical 绑定不增加文件系统探测。
      this.rawBindings.set(sourceId, captureCompilerRawBinding(sourceId, sourceId))
    }
  }

  override captureNative(id: string, code: string): void {
    if (!id.includes('?') && !id.startsWith('\0')) {
      withRealpathScope(() => {
        this.moduleInputs.add(compilerSourceId(id))
        super.captureNative(id, code)
      })
    }
  }

  /** 真实文本读取 owner 与 module loader 输出分别登记，原生分类重建不撤销 raw 身份。 */
  captureRaw(id: string, code: string | null, native = true, read?: CompilerRawRead): void {
    if (!id.includes('?') && !id.startsWith('\0')) {
      withRealpathScope(() => {
        const sourceId = compilerSourceId(id)
        this.rawInputs.add(sourceId)
        if (native && code !== null) {
          super.captureNative(id, code)
        }
        else {
          super.capture(id, code)
        }
        this.rememberRawBinding(id, sourceId)
        if (read?.source === code) {
          this.rawReads.set(sourceId, read)
        }
        else {
          this.rawReads.delete(sourceId)
        }
      })
    }
  }

  isRawInput(id: string): boolean {
    return this.rawInputs.has(compilerSourceId(id))
  }

  ownsRawSource(id: string): boolean {
    const binding = this.rawBindings.get(normalizeFsResolvedId(id))
    return this.ownsRawIdentity(compilerSourceId(id)) || (binding !== undefined && this.ownsRawIdentity(binding.target))
  }

  private ownsRawIdentity(id: string): boolean {
    return this.rawInputs.has(id) || (this.seededInputs.has(id) && !this.nativeInputIds.has(id) && !this.moduleInputs.has(id))
  }

  override seed(id: string, code: string | null, read?: CompilerRawRead): void {
    withRealpathScope(() => {
      const sourceId = compilerSourceId(id)
      const missing = super.readSource(id) === undefined
      this.seededInputs.add(sourceId)
      super.seed(id, code)
      this.rememberRawBinding(id, sourceId)
      if (missing && read?.source === code) {
        this.rawReads.set(sourceId, read)
      }
    })
  }

  override setNativeSources(ids: Iterable<string>): void {
    withRealpathScope(() => {
      const canonical = Array.from(ids, compilerSourceId)
      this.nativeInputIds = new Set(canonical)
      super.setNativeSources(canonical)
    })
  }

  override freeze(changedFiles: readonly string[]) {
    const input = super.freeze(changedFiles)
    const files = new Set([...new Set([...this.rawInputs, ...this.seededInputs])].filter(id => input.sources.has(id) && this.ownsRawIdentity(id)))
    rawSnapshots.set(input.sources, {
      files,
      changedFiles: input.changedFiles,
      reads: new Map([...this.rawReads].filter(([id, read]) => files.has(id) && read.source === input.sources.get(id))),
      bindings: new Map([...this.rawBindings].filter(([, binding]) => files.has(binding.target))),
    })
    return input
  }

  constructor() {
    super({
      sourceId: compilerSourceId,
      hasVisualChange(file, previous, current) {
        if (!file.endsWith('.vue')) {
          return /\.(?:jsx|tsx|wxml|wxss|css)$/.test(file)
        }
        if (typeof previous !== 'string' || typeof current !== 'string') {
          return true
        }
        const before = resolveVueSfcHmrSignatures(previous, file).blockSignatures
        const after = resolveVueSfcHmrSignatures(current, file).blockSignatures
        return !before || !after || before.template !== after.template || before.style !== after.style || before.config !== after.config
      },
    })
  }
}

export function getCompilerHmrHost(ctx: CompilerContext): CompilerHmrHost {
  let host = hosts.get(ctx)
  if (!host) {
    host = new CompilerHmrHost()
    hosts.set(ctx, host)
    if (ctx.configService) {
      hostsByConfig.set(ctx.configService, host)
    }
  }
  return host
}

export function getCompilerHmrHostByConfig(config: object): CompilerHmrHost | undefined {
  return hostsByConfig.get(config)
}
