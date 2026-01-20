interface ScenarioItem {
  id: string
  name: string
  desc: string
  tags: string[]
}

function resolveSelectedLabel(items: ScenarioItem[], selectedId: string) {
  if (!selectedId || !Array.isArray(items)) {
    return ''
  }
  const matched = items.find(item => item.id === selectedId)
  return matched?.name ?? ''
}

Component({
  properties: {
    title: {
      type: String,
      value: '互动场景',
    },
    summary: {
      type: String,
      value: '',
    },
    items: {
      type: Array,
      value: [] as ScenarioItem[],
      observer(this: WechatMiniprogram.Component.Instance) {
        const { items, selectedId } = this.data as unknown as {
          items: ScenarioItem[]
          selectedId: string
        }
        this.setData({
          selectedLabel: resolveSelectedLabel(items, selectedId),
        })
      },
    },
    selectedId: {
      type: String,
      value: '',
      observer(this: WechatMiniprogram.Component.Instance, next: string) {
        const { items } = this.data as unknown as { items: ScenarioItem[] }
        this.setData({
          selectedLabel: resolveSelectedLabel(items, next),
        })
      },
    },
  },
  data: {
    selectedLabel: '',
    emptyHint: '暂时没有可用场景',
  },
  lifetimes: {
    attached() {
      const { items, selectedId } = this.data as unknown as {
        items: ScenarioItem[]
        selectedId: string
      }
      this.setData({
        selectedLabel: resolveSelectedLabel(items, selectedId),
      })
    },
  },
  methods: {
    handleSelect(event: WechatMiniprogram.TouchEvent) {
      const { id, name } = event.currentTarget.dataset as {
        id?: string
        name?: string
      }
      if (!id || !name) {
        return
      }
      this.triggerEvent('select', {
        id,
        name,
      })
    },
  },
})
