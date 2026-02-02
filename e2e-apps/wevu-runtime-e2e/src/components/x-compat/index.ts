import { createWevuComponent } from 'wevu'

createWevuComponent({
  data: () => ({
    label: 'compat',
    count: 0,
  }),
  methods: {
    bump(this: any) {
      const runtime = (this as any).__wevu?.proxy ?? this
      const next = (runtime.count ?? 0) + 1
      runtime.count = next
      return runtime.count
    },
  },
})
