export interface NativeUsesVueProps {
  readonly title?: string
  readonly subtitle?: string
  readonly badge?: string
  readonly note?: string
}

declare const NativeUsesVue: new () => {
  $props: NativeUsesVueProps
}

export default NativeUsesVue
