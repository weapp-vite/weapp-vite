import { relayOnly } from '../shared/relay-only'

export function useRelayToken() {
  return relayOnly()
}
