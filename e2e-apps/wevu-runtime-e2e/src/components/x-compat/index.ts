Component({
  data: {
    label: 'compat',
    count: 0,
  },
  methods: {
    bump(this: any) {
      const next = ((this as any).data?.count ?? 0) + 1
      this.setData?.({ count: next })
      return next
    },
  },
})
