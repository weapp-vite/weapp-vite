import { createWevuComponent } from 'wevu'

createWevuComponent({
  data: () => ({
    label: 'compat',
    count: 0,
  }),
  methods: {
    bump(this: any) {
      const next = (this.data?.count ?? 0) + 1
      this.setData({ count: next })
      return next
    },
  },
})
