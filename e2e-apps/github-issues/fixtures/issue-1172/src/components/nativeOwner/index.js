Component({
  data: { exportKeys: 'pending', ownerLabel: 'pending', privateVisible: 'pending' },
  lifetimes: {
    ready() {
      const owner = this.selectOwnerComponent()
      this.setData({
        exportKeys: Object.keys(owner).sort().join(','),
        ownerLabel: owner.label,
        privateVisible: String('privateIncrement' in owner || 'setData' in owner || 'data' in owner),
      })
    },
  },
  methods: {
    incrementOwner() {
      this.selectOwnerComponent().increment()
    },
  },
})
