Component({
  properties: {
    count: {
      type: Number,
      value: 0
    },
    status: {
      type: String,
      value: 'idle'
    },
    title: {
      type: String,
      value: 'Status card'
    }
  },
  data: {
    internalClicks: 0,
    nestedBadge: '',
    componentIntersectionSnapshot: '',
    componentMediaMatches: [],
    observerLog: 'cold',
    actionLog: [],
    actionPills: ['warm', 'hot'],
    isBoosted: false
  },
  observers: {
    count() {
      this.setData({
        observerLog: `count:${this.properties.count}`
      })
    },
    status(value) {
      this.setData({
        isBoosted: value === 'boosted'
      })
    }
  },
  lifetimes: {
    attached() {
      this.setData({
        observerLog: `attached:${this.properties.count}`
      })
    },
    detached() {
      this.setData({
        observerLog: 'detached'
      })
    }
  },
  methods: {
    pulse() {
      this.setData({
        internalClicks: this.data.internalClicks + 1,
        actionLog: [...this.data.actionLog, 'pulse']
      }, () => {
        this.triggerEvent('pulse', {
          phase: `pulse-${this.data.internalClicks}`,
          count: this.properties.count
        }, {
          bubbles: true,
          composed: true
        })
      })
    },
    inspectNested() {
      const badge = this.selectComponent?.('#mini-badge')
      const badges = this.selectAllComponents?.('mini-badge') ?? []
      this.setData({
        actionLog: [...this.data.actionLog, 'inspect'],
        nestedBadge: JSON.stringify({
          badgeReady: !!badge,
          label: badge?.properties?.label ?? '',
          size: badges.length
        })
      })
      this.triggerEvent('pulse', {
        phase: `inspect-${badges.length}`,
        count: this.properties.count
      }, {
        bubbles: true,
        composed: true
      })
    },
    inspectComponentIntersection() {
      const observer = this.createIntersectionObserver({
        thresholds: [0, 1],
      }).relativeToViewport()
      observer.observe('#component-observer-target', (result) => {
        this.setData({
          componentIntersectionSnapshot: JSON.stringify(result),
        })
        observer.disconnect()
      })
    },
    inspectComponentMedia() {
      const observer = this.createMediaQueryObserver()
      observer.observe({
        maxWidth: 390,
        orientation: 'portrait',
      }, (result) => {
        this.setData({
          componentMediaMatches: [...this.data.componentMediaMatches, result.matches],
        })
      })
    },
    applyInternalAction(event) {
      const phase = event?.currentTarget?.dataset?.phase || 'unknown'
      this.setData({
        actionLog: [...this.data.actionLog, phase]
      })
    }
  }
})
