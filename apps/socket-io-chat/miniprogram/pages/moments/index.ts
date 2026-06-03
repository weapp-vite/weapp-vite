import { loadMoments, type Moment } from '../../utils/api'

Page({
  data: {
    error: '',
    loading: true,
    moments: [] as Moment[],
    refreshedAtText: '',
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
      const response = await loadMoments()
      this.setData({
        moments: response.items,
        refreshedAtText: formatTime(response.refreshedAt),
      })
    }
    catch (cause) {
      this.setData({
        error: cause instanceof Error ? cause.message : '朋友圈加载失败',
      })
    }
    finally {
      this.setData({
        loading: false,
      })
    }
  },
})

function formatTime(value: number) {
  const date = new Date(value)
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${hours}:${minutes}`
}
