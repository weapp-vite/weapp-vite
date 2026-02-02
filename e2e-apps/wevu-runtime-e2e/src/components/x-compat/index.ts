import { createWevuComponent } from 'wevu'

createWevuComponent({
  data: () => ({
    label: 'compat',
    count: 0,
  }),
  methods: {
    bump(this: any) {
      const next = (this.count ?? 0) + 1
      this.count = next
      return this.count
    },
  },
})
