import { sharedMarker } from '../state'

export function lazyValue() {
  return `target:initial:${sharedMarker}`
}
