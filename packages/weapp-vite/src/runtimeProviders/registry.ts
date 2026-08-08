import type { RuntimeProvider, RuntimeProviderSelection } from './types'

function selectionKey(selection: RuntimeProviderSelection) {
  return `${selection.backend}:${selection.compilation}`
}

export class RuntimeProviderRegistry {
  private readonly providers: RuntimeProvider[] = []
  private readonly providerById = new Map<string, RuntimeProvider>()
  private readonly providerBySelection = new Map<string, RuntimeProvider>()

  register(provider: RuntimeProvider) {
    const id = provider.descriptor.id.trim()
    if (!id) {
      throw new Error('运行时 provider id 不能为空。')
    }
    if (this.providerById.has(id)) {
      throw new Error(`运行时 provider id "${id}" 已注册。`)
    }
    const key = selectionKey(provider.descriptor)
    const existing = this.providerBySelection.get(key)
    if (existing) {
      throw new Error(`运行时 provider 选择 "${key}" 已由 "${existing.descriptor.id}" 注册。`)
    }
    this.providers.push(provider)
    this.providerById.set(id, provider)
    this.providerBySelection.set(key, provider)
  }

  get(id: string) {
    return this.providerById.get(id.trim())
  }

  getAll(): readonly RuntimeProvider[] {
    return this.providers
  }

  resolve(selection: RuntimeProviderSelection) {
    const provider = this.providerBySelection.get(selectionKey(selection))
    if (!provider) {
      throw new Error(`没有可用于 ${selection.backend}/${selection.compilation} 的运行时 provider。`)
    }
    return provider
  }
}
