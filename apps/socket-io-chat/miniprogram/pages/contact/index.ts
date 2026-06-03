import { loadContactProfile, type ContactProfile } from '../../utils/api'

const emptyProfile: ContactProfile = {
  id: '',
  name: '',
  title: '',
  avatarText: '',
  city: '',
  status: '',
  signature: '',
  tags: [],
  stats: [],
  recent: [],
}

Page({
  data: {
    error: '',
    loading: true,
    profile: emptyProfile,
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
      const profile = await loadContactProfile()
      this.setData({
        profile,
      })
    }
    catch (cause) {
      this.setData({
        error: cause instanceof Error ? cause.message : '联系人加载失败',
      })
    }
    finally {
      this.setData({
        loading: false,
      })
    }
  },
})
