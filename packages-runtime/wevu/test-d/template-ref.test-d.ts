// eslint-disable-next-line wevu/no-risky-api -- 类型契约需要直接验证 Wevu 的 Vue 兼容类型。
import type { ComponentOptionsMixin, ComponentProvideOptions, DefineComponent, PublicProps } from 'vue'
import type { MiniProgramTemplateRefElements, MiniProgramTemplateRefValue, TemplateRef, TemplateRefValue } from 'wevu'
import { expectError, expectType } from 'tsd'
import { ref, useTemplateRef } from 'wevu'

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

declare module 'wevu' {
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
expectType<MiniProgramTemplateRefValue | null>(view.value)
expectType<string>(view.value!.selector)

const child = useTemplateRef('childRef')
expectType<(() => void) | undefined>(child.value?.open)
expectError(child.value?.close)

const childRef = ref<InstanceType<ExposedPanel> | null>(null)
expectType<(() => void) | undefined>(childRef.value?.open)
expectError(childRef.value?.close)

const unknownRef = useTemplateRef('missing')
expectType<TemplateRef<unknown>>(unknownRef)

type ViewElement = MiniProgramTemplateRefElements['view']
type MapElement = MiniProgramTemplateRefElements['map']
type AlipayLottieElement = MiniProgramTemplateRefElements['lottie']
type TtMaskElement = MiniProgramTemplateRefElements['mask']
type WeappEditorElement = MiniProgramTemplateRefElements['editor']
expectType<TemplateRefValue>({} as ViewElement)
expectType<MiniProgramTemplateRefValue>({} as ViewElement)
expectType<TemplateRefValue>({} as MapElement)
expectType<TemplateRefValue>({} as AlipayLottieElement)
expectType<TemplateRefValue>({} as TtMaskElement)
expectType<TemplateRefValue>({} as WeappEditorElement)

expectType<HTMLMapElement>({} as HTMLElementTagNameMap['map'])
expectType<false>({} as ('view' extends keyof HTMLElementTagNameMap ? true : false))
expectType<false>({} as ('lottie' extends keyof HTMLElementTagNameMap ? true : false))
expectType<false>({} as ('mask' extends keyof HTMLElementTagNameMap ? true : false))
expectType<false>({} as ('editor' extends keyof HTMLElementTagNameMap ? true : false))
expectType<true>({} as (HTMLElementTagNameMap[keyof HTMLElementTagNameMap] extends Element ? true : false))
