import { loadConversationInsight, type ConversationInsight } from '../../utils/api'

const emptyInsight: ConversationInsight = {
  summary: {
    title: '',
    description: '',
    health: '',
  },
  metrics: [],
  threads: [],
  actions: [],
}

Page({
  data: {
    error: '',
    insight: emptyInsight,
    loading: true,
  },
  onLoad() {
    void this.refresh()
  },
  async refresh() {
    this.setData({
      error: '',
      loading: true,
    })
    try {
      const insight = await loadConversationInsight()
      this.setData({
        insight,
      })
    }
    catch (cause) {
      this.setData({
        error: cause instanceof Error ? cause.message : '会话洞察加载失败',
      })
    }
    finally {
      this.setData({
        loading: false,
      })
    }
  },
})
