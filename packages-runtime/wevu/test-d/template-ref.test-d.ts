import type { ComponentOptionsMixin, ComponentProvideOptions, DefineComponent, PublicProps } from 'vue'
import type { TemplateRef, TemplateRefValue } from '@/index'
import { expectError, expectType } from 'tsd'
import { ref, useTemplateRef } from '@/index'

type EmptyRecord = Record<string, never>

type ExposedPanel = DefineComponent<
  EmptyRecord,
  {
    close: () => void
    open: () => void
  },
  EmptyRecord,
  EmptyRecord,
  EmptyRecord,
  ComponentOptionsMixin,
  ComponentOptionsMixin,
  EmptyRecord,
  string,
  PublicProps,
  EmptyRecord,
  EmptyRecord,
  EmptyRecord,
  EmptyRecord,
  EmptyRecord,
  'open',
  ComponentProvideOptions
>

declare module '@/index' {
  interface TemplateRefs {
    childRef: InstanceType<ExposedPanel>
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

const child = useTemplateRef('childRef')
expectType<(() => void) | undefined>(child.value?.open)
expectError(child.value?.close)

const childRef = ref<InstanceType<ExposedPanel> | null>(null)
expectType<(() => void) | undefined>(childRef.value?.open)
expectError(childRef.value?.close)

const unknownRef = useTemplateRef('missing')
expectType<TemplateRef<unknown>>(unknownRef)

type ViewElement = HTMLElementTagNameMap['view']
expectType<TemplateRefValue>({} as ViewElement)
