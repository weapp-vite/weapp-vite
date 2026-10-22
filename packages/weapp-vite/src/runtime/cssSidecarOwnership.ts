import type { RuntimeState } from './runtimeState'
import { normalizeFsResolvedId } from '../utils/resolvedId'

/** 用入口本轮扫描结果替换旧归属，并维护供 CSS 发布阶段读取的并集。 */
export function replaceEntryStyleImports(css: RuntimeState['css'], rawOwnerId: string, imports: Iterable<string>): void {
  const ownerId = normalizeFsResolvedId(rawOwnerId)
  const previous = css.sidecarImportsByOwner.get(ownerId)
  const next = new Set(Array.from(imports, file => normalizeFsResolvedId(file)))
  css.sidecarImportsByOwner.set(ownerId, next)
  for (const style of previous ?? []) {
    if (!next.has(style) && !Array.from(css.sidecarImportsByOwner.values()).some(styles => styles.has(style))) {
      css.sidecarImports.delete(style)
      css.transformedSidecarSource.delete(style)
    }
  }
  for (const style of next) {
    css.sidecarImports.add(style)
  }
}
