import { leafA } from './leafA'
import { leafB } from './leafB'

export function barrelValue() {
  return `${leafA()}:${leafB()}`
}
