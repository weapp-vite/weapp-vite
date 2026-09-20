import type { HeadlessComponentInstance, HeadlessWxSelectorQuery } from '..'
import { expectError, expectType } from 'tsd'

declare const component: HeadlessComponentInstance
expectType<HeadlessComponentInstance[]>(component.getRelationNodes('../child/index'))
expectError(component.getRelationNodes(1))
if (component.createSelectorQuery) {
  expectType<HeadlessWxSelectorQuery>(component.createSelectorQuery())
}
