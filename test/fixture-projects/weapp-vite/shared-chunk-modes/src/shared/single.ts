import { singleLeaf } from './single-leaf'

export function single() {
  return `__SINGLE_MARKER__:${singleLeaf()}`
}
