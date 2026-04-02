import type { TemplateRef, TemplateRefValue } from '@/index'
import { expectError, expectType } from 'tsd'
import { useTemplateRef } from '@/index'

declare module '@/index' {
  interface TemplateRefs {
    headerRef: { title: string }
    viewRef: TemplateRefValue
  }
}

const header = useTemplateRef('headerRef')
expectType<TemplateRef<{ title: string }>>(header)
expectType<{ title: string } | null>(header.value)
expectError(header.value = { title: 'next' })

const view = useTemplateRef('viewRef')
expectType<TemplateRefValue | null>(view.value)

const unknownRef = useTemplateRef('missing')
expectType<TemplateRef<unknown>>(unknownRef)

type ViewElement = HTMLElementTagNameMap['view']
expectType<TemplateRefValue>({} as ViewElement)
