import type { HeadlessComponentInstance, HeadlessPageInstance } from '..'
import { expectType } from 'tsd'

declare const page: HeadlessPageInstance
declare const component: HeadlessComponentInstance
expectType<Record<string, any>>(page.properties)
expectType<Record<string, any>>(component.properties)
