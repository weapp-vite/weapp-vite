<script setup lang="ts">
import type { GoodsCommentItem, GoodsCommentsCount } from '../../../model/comments'
import type { FetchCommentsParams } from '../../../services/comments/fetchComments'
import dayjs from 'dayjs'
import { onLoad, onReachBottom, ref } from 'wevu'
import { showToast } from '@/hooks/useToast'
import { fetchComments } from '../../../services/comments/fetchComments'
import { fetchCommentsCount } from '../../../services/comments/fetchCommentsCount'

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
      commentTime: dayjs(Number(item.commentTime)).format('YYYY/MM/DD HH:mm'),
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

function changeTag(e: { currentTarget?: { dataset?: { commenttype?: string } } }) {
  const nextCommentType = e.currentTarget?.dataset?.commenttype ?? ''
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
    <t-tag :t-class="`comments-header-tag ${commentType === '' ? 'comments-header-active' : ''} [margin-top:24rpx] [margin-left:24rpx] ![height:56rpx] ![font-size:24rpx] [justify-content:center] ![background-color:#F5F5F5] ![border-radius:8rpx] ![border:1px_solid_#F5F5F5] [background-color:#FFECE9] [color:#FA4126] [border:1px_solid_#FA4126]`" data-commentType="" @tap="changeTag">
      全部({{ countObj.commentCount }})
    </t-tag>
    <t-tag
      v-if="countObj.uidCount !== '0'"
      :t-class="`comments-header-tag ${commentType === '5' ? 'comments-header-active' : ''} [margin-top:24rpx] [margin-left:24rpx] ![height:56rpx] ![font-size:24rpx] [justify-content:center] ![background-color:#F5F5F5] ![border-radius:8rpx] ![border:1px_solid_#F5F5F5] [background-color:#FFECE9] [color:#FA4126] [border:1px_solid_#FA4126]`"
      data-commentType="5"
      @tap="changeTag"
    >
      自己({{ countObj.uidCount }})
    </t-tag>
    <t-tag :t-class="`comments-header-tag ${commentType === '4' ? 'comments-header-active' : ''} [margin-top:24rpx] [margin-left:24rpx] ![height:56rpx] ![font-size:24rpx] [justify-content:center] ![background-color:#F5F5F5] ![border-radius:8rpx] ![border:1px_solid_#F5F5F5] [background-color:#FFECE9] [color:#FA4126] [border:1px_solid_#FA4126]`" data-commentType="4" @tap="changeTag">
      带图({{ countObj.hasImageCount }})
    </t-tag>
    <t-tag :t-class="`comments-header-tag ${commentType === '3' ? 'comments-header-active' : ''} [margin-top:24rpx] [margin-left:24rpx] ![height:56rpx] ![font-size:24rpx] [justify-content:center] ![background-color:#F5F5F5] ![border-radius:8rpx] ![border:1px_solid_#F5F5F5] [background-color:#FFECE9] [color:#FA4126] [border:1px_solid_#FA4126]`" data-commentType="3" @tap="changeTag">
      好评({{ countObj.goodCount }})
    </t-tag>
    <t-tag :t-class="`comments-header-tag ${commentType === '2' ? 'comments-header-active' : ''} [margin-top:24rpx] [margin-left:24rpx] ![height:56rpx] ![font-size:24rpx] [justify-content:center] ![background-color:#F5F5F5] ![border-radius:8rpx] ![border:1px_solid_#F5F5F5] [background-color:#FFECE9] [color:#FA4126] [border:1px_solid_#FA4126]`" data-commentType="2" @tap="changeTag">
      中评({{ countObj.middleCount }})
    </t-tag>
    <t-tag :t-class="`comments-header-tag ${commentType === '1' ? 'comments-header-active' : ''} [margin-top:24rpx] [margin-left:24rpx] ![height:56rpx] ![font-size:24rpx] [justify-content:center] ![background-color:#F5F5F5] ![border-radius:8rpx] ![border:1px_solid_#F5F5F5] [background-color:#FFECE9] [color:#FA4126] [border:1px_solid_#FA4126]`" data-commentType="1" @tap="changeTag">
      差评({{ countObj.badCount }})
    </t-tag>
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
