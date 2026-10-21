import type { HmrRuntimeFallbackReason } from '../hmrRuntimeCapabilities'
import type { StatefulHmrSnapshot } from './globalStyles'

/** 只比较编译完成的冻结快照；原生 WXML 由宿主独立更新，不参与编译模板注册。 */
export function resolveTemplateRegistrationFallback(
  previous: StatefulHmrSnapshot['templateRegistrationSignatures'],
  snapshot: Pick<StatefulHmrSnapshot, 'templateRegistrationSignatures' | 'entryIds'>,
): HmrRuntimeFallbackReason | undefined {
  const current = snapshot.templateRegistrationSignatures
  const owners = new Set([
    ...(previous?.keys() ?? []),
    ...(current?.keys() ?? []),
    ...(snapshot.entryIds ?? []).filter(id => /\.(?:vue|jsx|tsx)$/.test(id)),
  ])
  const changed = [...owners].filter(owner => !previous?.get(owner) || !current?.get(owner) || previous.get(owner) !== current.get(owner))
  if (changed.length) {
    return {
      code: 'native-registration',
      message: '编译模板注册签名发生变化或缺少能力证明，需要 classic 重新建立模板、计算绑定与事件注册。',
      files: changed,
    }
  }
}
