<script setup lang="ts">
import type { GoodsCommentItem, GoodsCommentsCount } from '../../../model/comments'
import type { FetchCommentsParams } from '../../../services/comments/fetchComments'
import { onLoad, onReachBottom, ref } from 'wevu'
import { showToast } from '@/hooks/useToast'
import { fetchComments } from '../../../services/comments/fetchComments'
import { fetchCommentsCount } from '../../../services/comments/fetchCommentsCount'
import { formatTime } from '../../../utils/util'

interface QueryOptions {
  spuId?: string
  commentLevel?: string
  hasImage?: string
}

interface CommentCountState extends GoodsCommentsCount {}
type NormalizedCommentItem = GoodsCommentItem & {
  commentResources: Array<{
    src?: string
    type?: string
    coverSrc?: string
  }>
}

const pageLoading = ref(false)
const commentList = ref<NormalizedCommentItem[]>([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const hasLoaded = ref(false)
const loadMoreStatus = ref(0)
const spuId = ref('1060004')
const commentLevel = ref('')
const hasImage = ref('')
const commentType = ref('')
const totalCount = ref(0)
const countObj = ref<CommentCountState>({
  badCount: '0',
  commentCount: '0',
  goodCount: '0',
  middleCount: '0',
  hasImageCount: '0',
  uidCount: '0',
  goodRate: 0,
})

function generalQueryData(reset: boolean): FetchCommentsParams {
  const params: FetchCommentsParams = {
    pageNum: reset ? 1 : pageNum.value + 1,
    pageSize: reset ? 30 : pageSize.value,
    queryParameter: {
      spuId: spuId.value,
    },
  }

  const normalizedCommentLevel = Number(commentLevel.value)
  if ([1, 2, 3].includes(normalizedCommentLevel)) {
    params.queryParameter!.commentLevel = normalizedCommentLevel
  }
  if (hasImage.value === '1') {
    params.queryParameter!.hasImage = true
  }

  return params
}

function normalizeCommentList(list: GoodsCommentItem[]): NormalizedCommentItem[] {
  return list.map((item) => {
    const resourceItem = item as GoodsCommentItem & {
      commentResources?: NormalizedCommentItem['commentResources']
      commentImageUrls?: NormalizedCommentItem['commentResources']
    }
    return {
      ...item,
      commentResources: resourceItem.commentResources || resourceItem.commentImageUrls || [],
      commentTime: formatTime(Number(item.commentTime), 'YYYY/MM/DD HH:mm'),
    }
  })
}

async function getCount(options: QueryOptions) {
  try {
    countObj.value = await fetchCommentsCount({
      spuId: options.spuId,
    }, {
      method: 'POST',
    })
  }
  catch {}
}

async function init(reset = true) {
  if (loadMoreStatus.value !== 0) {
    return
  }

  pageLoading.value = true
  loadMoreStatus.value = 1
  const params = generalQueryData(reset)

  try {
    const data = await fetchComments(params, {
      method: 'POST',
    })
    const nextPageList = normalizeCommentList(data.pageList || [])
    const nextTotalCount = Number(data.totalCount || 0)

    if (nextTotalCount === 0 && reset) {
      commentList.value = []
      total.value = 0
      totalCount.value = 0
      loadMoreStatus.value = 2
      return
    }

    const mergedList = reset ? nextPageList : commentList.value.concat(nextPageList)
    commentList.value = mergedList
    pageNum.value = params.pageNum || 1
    pageSize.value = params.pageSize || pageSize.value
    total.value = nextTotalCount
    totalCount.value = nextTotalCount
    loadMoreStatus.value = mergedList.length >= nextTotalCount ? 2 : 0
  }
  catch {
    loadMoreStatus.value = 0
    showToast({
      message: '查询失败，请稍候重试',
    })
  }
  finally {
    hasLoaded.value = true
    pageLoading.value = false
  }
}

function getComments(options: QueryOptions) {
  const nextCommentLevel = options.commentLevel ?? ''
  const nextHasImage = options.hasImage ?? ''

  commentLevel.value = nextCommentLevel === '-1' ? '' : nextCommentLevel
  hasImage.value = nextHasImage
  commentType.value = nextHasImage ? '4' : (nextCommentLevel === '-1' ? '' : nextCommentLevel)
  spuId.value = options.spuId || spuId.value
  void init(true)
}

function resetListState() {
  loadMoreStatus.value = 0
  commentList.value = []
  total.value = 0
  totalCount.value = 0
  pageNum.value = 1
}

function changeTag(nextCommentType: string) {
  if (commentType.value === nextCommentType) {
    return
  }

  resetListState()

  if (nextCommentType === '' || nextCommentType === '5') {
    hasImage.value = ''
    commentLevel.value = ''
  }
  else if (nextCommentType === '4') {
    hasImage.value = '1'
    commentLevel.value = ''
  }
  else {
    hasImage.value = ''
    commentLevel.value = nextCommentType
  }

  commentType.value = nextCommentType
  void init(true)
}

onLoad((options: QueryOptions = {}) => {
  void getCount(options)
  getComments(options)
})

onReachBottom(() => {
  if (commentList.value.length >= total.value) {
    loadMoreStatus.value = 2
    return
  }
  void init(false)
})

definePageJson({
  navigationBarTitleText: '全部评价',
  usingComponents: {
    't-tag': 'tdesign-miniprogram/tag/tag',
    'comments-card': './components/comments-card/index',
    't-load-more': '/components/load-more/index',
  },
})
</script>

<template>
  <view class="comments-header flex flex-wrap p-[32rpx_32rpx_0rpx] bg-white mt-[-24rpx] ml-[-24rpx]">
    <view id="comments-filter-all" class="comments-header-tag" @tap="changeTag('')">
      <t-tag :theme="commentType === '' ? 'danger' : 'default'" :variant="commentType === '' ? 'light-outline' : 'dark'">
        全部({{ countObj.commentCount }})
      </t-tag>
    </view>
    <view v-if="countObj.uidCount !== '0'" id="comments-filter-own" class="comments-header-tag" @tap="changeTag('5')">
      <t-tag :theme="commentType === '5' ? 'danger' : 'default'" :variant="commentType === '5' ? 'light-outline' : 'dark'">
        自己({{ countObj.uidCount }})
      </t-tag>
    </view>
    <view id="comments-filter-image" class="comments-header-tag" @tap="changeTag('4')">
      <t-tag :theme="commentType === '4' ? 'danger' : 'default'" :variant="commentType === '4' ? 'light-outline' : 'dark'">
        带图({{ countObj.hasImageCount }})
      </t-tag>
    </view>
    <view id="comments-filter-good" class="comments-header-tag" @tap="changeTag('3')">
      <t-tag :theme="commentType === '3' ? 'danger' : 'default'" :variant="commentType === '3' ? 'light-outline' : 'dark'">
        好评({{ countObj.goodCount }})
      </t-tag>
    </view>
    <view id="comments-filter-middle" class="comments-header-tag" @tap="changeTag('2')">
      <t-tag :theme="commentType === '2' ? 'danger' : 'default'" :variant="commentType === '2' ? 'light-outline' : 'dark'">
        中评({{ countObj.middleCount }})
      </t-tag>
    </view>
    <view id="comments-filter-bad" class="comments-header-tag" @tap="changeTag('1')">
      <t-tag :theme="commentType === '1' ? 'danger' : 'default'" :variant="commentType === '1' ? 'light-outline' : 'dark'">
        差评({{ countObj.badCount }})
      </t-tag>
    </view>
  </view>
  <view class="comments-card-list">
    <block v-for="(item, index) in commentList" :key="index">
      <comments-card
        :commentScore="item.commentScore"
        :userName="item.userName"
        :commentResources="item.commentResources || []"
        :commentContent="item.commentContent"
        :isAnonymity="item.isAnonymity"
        :commentTime="item.commentTime"
        :isAutoComment="item.isAutoComment"
        :userHeadUrl="item.userHeadUrl"
        :specInfo="item.specInfo"
        :sellerReply="item.sellerReply || ''"
        :goodsDetailInfo="item.goodsDetailInfo || ''"
      />
    </block>
    <t-load-more
      t-class="no-more [padding-left:20rpx] [padding-right:20rpx]"
      :status="loadMoreStatus"
      no-more-text="没有更多了"
      color="#BBBBBB"
      failedColor="#FA550F"
    />
  </view>
</template>

<style>
.comments-header {
  --td-tag-danger-color: #fa4126;
  --td-tag-danger-light-color: #ffece9;
  --td-tag-default-color: #f5f5f5;
  --td-tag-default-font-color: #333;
  --td-tag-medium-padding: 6rpx 14rpx;

  display: flex;
  flex-wrap: wrap;
  padding: 32rpx 32rpx 0;
  margin-top: -24rpx;
  margin-left: -24rpx;
  background: #fff;
}

.comments-header-tag {
  margin-top: 24rpx;
  margin-left: 24rpx;
}

.comments-card-list {
  background: #fff;
}
</style>
