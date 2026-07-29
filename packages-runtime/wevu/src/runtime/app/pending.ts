import type { RuntimeApp } from '../types'

export interface PendingRuntimeAppRegistration {
  app: RuntimeApp<any, any, any>
  register: () => void
}

let pendingRuntimeAppRegistration: PendingRuntimeAppRegistration | undefined

export function setPendingRuntimeAppRegistration(registration: PendingRuntimeAppRegistration): void {
  pendingRuntimeAppRegistration = registration
}

export function takePendingRuntimeAppRegistration(): PendingRuntimeAppRegistration | undefined {
  const registration = pendingRuntimeAppRegistration
  pendingRuntimeAppRegistration = undefined
  return registration
}
