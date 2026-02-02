import { defineComponent, resetWevuDefaults, setWevuDefaults } from 'wevu'

setWevuDefaults({
  component: {
    options: {
      multipleSlots: false,
    },
    setData: {
      maxPatchKeys: 1,
    },
  },
})

const defaultsComponent = defineComponent({
  data: () => ({
    foo: 'bar',
  }),
})

export const defaultsSnapshot = {
  multipleSlots: (defaultsComponent as any).__wevu_options?.mpOptions?.options?.multipleSlots,
  maxPatchKeys: (defaultsComponent as any).__wevu_options?.setData?.maxPatchKeys,
}

resetWevuDefaults()
