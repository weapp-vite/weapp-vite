<script lang="ts">
import { fetchComments } from '../../../services/comments/fetchComments';
import { fetchCommentsCount } from '../../../services/comments/fetchCommentsCount';
import dayjs from 'dayjs';
const layoutMap = {
  0: 'vertical',
};
Page({
  data: {
    pageLoading: false,
    commentList: [],
    pageNum: 1,
    myPageNum: 1,
    pageSize: 10,
    total: 0,
    myTotal: 0,
    hasLoaded: false,
    layoutText: layoutMap[0],
    loadMoreStatus: 0,
    myLoadStatus: 0,
    spuId: '1060004',
    commentLevel: '',
    hasImage: '',
    commentType: '',
    totalCount: 0,
    countObj: {
      badCount: '0',
      commentCount: '0',
      goodCount: '0',
      middleCount: '0',
      hasImageCount: '0',
      uidCount: '0',
    },
  },
  onLoad(options) {
    this.getCount(options);
    this.getComments(options);
  },
  async getCount(options) {
    try {
      const result = await fetchCommentsCount(
        {
          spuId: options.spuId,
        },
        {
          method: 'POST',
        },
      );
      this.setData({
        countObj: result,
      });
      // const { data, code = '' } = result;
      // if (code.toUpperCase() === 'SUCCESS') {
      //     wx.setNavigationBarTitle({
      //     title: `全部评价(${data.commentCount})`,
      //     });
      //     this.setData({
      //     countObj: data,
      //     });
      // } else {
      //     wx.showToast({
      //     title: '查询失败，请稍候重试',
      //     });
      // }
    } catch (error) {}
  },
  generalQueryData(reset) {
    const { hasImage, pageNum, pageSize, spuId, commentLevel } = this.data;
    const params = {
      pageNum: 1,
      pageSize: 30,
      queryParameter: {
        spuId,
      },
    };
    if (
      Number(commentLevel) === 3 ||
      Number(commentLevel) === 2 ||
      Number(commentLevel) === 1
    ) {
      params.queryParameter.commentLevel = Number(commentLevel);
    }
    if (hasImage && hasImage === '1') {
      params.queryParameter.hasImage = true;
    } else {
      delete params.queryParameter.hasImage;
    }
    // 重置请求
    if (reset) return params;

    return {
      ...params,
      pageNum: pageNum + 1,
      pageSize,
    };
  },
  async init(reset = true) {
    const { loadMoreStatus, commentList = [] } = this.data;
    const params = this.generalQueryData(reset);

    // 在加载中或者无更多数据，直接返回
    if (loadMoreStatus !== 0) return;

    this.setData({
      loadMoreStatus: 1,
    });

    try {
      const data = await fetchComments(params, {
        method: 'POST',
      });
      const code = 'SUCCESS';
      if (code.toUpperCase() === 'SUCCESS') {
        const { pageList, totalCount = 0 } = data;
        pageList.forEach((item) => {
          // eslint-disable-next-line no-param-reassign
          item.commentTime = dayjs(Number(item.commentTime)).format(
            'YYYY/MM/DD HH:mm',
          );
        });

        if (Number(totalCount) === 0 && reset) {
          this.setData({
            commentList: [],
            hasLoaded: true,
            total: totalCount,
            loadMoreStatus: 2,
          });
          return;
        }
        const _commentList = reset ? pageList : commentList.concat(pageList);
        const _loadMoreStatus =
          _commentList.length === Number(totalCount) ? 2 : 0;
        this.setData({
          commentList: _commentList,
          pageNum: params.pageNum || 1,
          totalCount: Number(totalCount),
          loadMoreStatus: _loadMoreStatus,
        });
      } else {
        wx.showToast({
          title: '查询失败，请稍候重试',
        });
      }
    } catch (error) {}
    this.setData({
      hasLoaded: true,
    });
  },
  getScoreArray(score) {
    var array = [];
    for (let i = 0; i < 5; i++) {
      if (i < score) {
        array.push(2);
      } else {
        array.push(0);
      }
    }
    return array;
  },
  getComments(options) {
    const { commentLevel = -1, spuId, hasImage = '' } = options;
    if (commentLevel !== -1) {
      this.setData({
        commentLevel: commentLevel,
      });
    }
    this.setData({
      hasImage: hasImage,
      commentType: hasImage ? '4' : '',
      spuId: spuId,
    });
    this.init(true);
  },
  changeTag(e) {
    var { commenttype } = e.currentTarget.dataset;
    var { commentType } = this.data;
    if (commentType === commenttype) return;
    this.setData({
      loadMoreStatus: 0,
      commentList: [],
      total: 0,
      myTotal: 0,
      myPageNum: 1,
      pageNum: 1,
    });
    if (commenttype === '' || commenttype === '5') {
      this.setData({
        hasImage: '',
        commentLevel: '',
      });
    } else if (commenttype === '4') {
      this.setData({
        hasImage: '1',
        commentLevel: '',
      });
    } else {
      this.setData({
        hasImage: '',
        commentLevel: commenttype,
      });
    }
    if (commenttype === '5') {
      this.setData({
        myLoadStatus: 1,
        commentType: commenttype,
      });
      this.getMyCommentsList();
    } else {
      this.setData({
        myLoadStatus: 0,
        commentType: commenttype,
      });
      this.init(true);
    }
  },
  onReachBottom() {
    const { total = 0, commentList } = this.data;
    if (commentList.length === total) {
      this.setData({
        loadMoreStatus: 2,
      });
      return;
    }

    this.init(false);
  },
});
</script>

<template>
<view class="comments-header [display:flex] [flex-wrap:wrap] [padding:32rpx_32rpx_0rpx] [background-color:#fff] [margin-top:-24rpx] [margin-left:-24rpx]">
	<t-tag t-class="comments-header-tag {{commentType === '' ? 'comments-header-active' : ''}} [margin-top:24rpx] [margin-left:24rpx] ![height:56rpx] ![font-size:24rpx] [justify-content:center] ![background-color:#F5F5F5] ![border-radius:8rpx] ![border:1px_solid_#F5F5F5] [background-color:#FFECE9] [color:#FA4126] [border:1px_solid_#FA4126]" data-commentType="" bindtap="changeTag">
		全部({{countObj.commentCount}})
	</t-tag>
	<t-tag
	  t-class="comments-header-tag {{commentType === '5' ? 'comments-header-active' : ''}} [margin-top:24rpx] [margin-left:24rpx] ![height:56rpx] ![font-size:24rpx] [justify-content:center] ![background-color:#F5F5F5] ![border-radius:8rpx] ![border:1px_solid_#F5F5F5] [background-color:#FFECE9] [color:#FA4126] [border:1px_solid_#FA4126]"
	  wx:if="{{countObj.uidCount !== '0'}}"
	  data-commentType="5"
	  bindtap="changeTag"
	>
		自己({{countObj.uidCount}})
	</t-tag>
	<t-tag t-class="comments-header-tag {{commentType === '4' ? 'comments-header-active' : ''}} [margin-top:24rpx] [margin-left:24rpx] ![height:56rpx] ![font-size:24rpx] [justify-content:center] ![background-color:#F5F5F5] ![border-radius:8rpx] ![border:1px_solid_#F5F5F5] [background-color:#FFECE9] [color:#FA4126] [border:1px_solid_#FA4126]" data-commentType="4" bindtap="changeTag">
		带图({{countObj.hasImageCount}})
	</t-tag>
	<t-tag t-class="comments-header-tag {{commentType === '3' ? 'comments-header-active' : ''}} [margin-top:24rpx] [margin-left:24rpx] ![height:56rpx] ![font-size:24rpx] [justify-content:center] ![background-color:#F5F5F5] ![border-radius:8rpx] ![border:1px_solid_#F5F5F5] [background-color:#FFECE9] [color:#FA4126] [border:1px_solid_#FA4126]" data-commentType="3" bindtap="changeTag">
		好评({{countObj.goodCount}})
	</t-tag>
	<t-tag t-class="comments-header-tag {{commentType === '2' ? 'comments-header-active' : ''}} [margin-top:24rpx] [margin-left:24rpx] ![height:56rpx] ![font-size:24rpx] [justify-content:center] ![background-color:#F5F5F5] ![border-radius:8rpx] ![border:1px_solid_#F5F5F5] [background-color:#FFECE9] [color:#FA4126] [border:1px_solid_#FA4126]" data-commentType="2" bindtap="changeTag">
		中评({{countObj.middleCount}})
	</t-tag>
	<t-tag t-class="comments-header-tag {{commentType === '1' ? 'comments-header-active' : ''}} [margin-top:24rpx] [margin-left:24rpx] ![height:56rpx] ![font-size:24rpx] [justify-content:center] ![background-color:#F5F5F5] ![border-radius:8rpx] ![border:1px_solid_#F5F5F5] [background-color:#FFECE9] [color:#FA4126] [border:1px_solid_#FA4126]" data-commentType="1" bindtap="changeTag">
		差评({{countObj.badCount}})
	</t-tag>
</view>
<view class="comments-card-list">
	<block wx:for="{{commentList}}" wx:key="index">
		<comments-card
		  commentScore="{{item.commentScore}}"
		  userName="{{item.userName}}"
		  commentResources="{{item.commentResources || []}}"
		  commentContent="{{item.commentContent}}"
		  isAnonymity="{{item.isAnonymity}}"
		  commentTime="{{item.commentTime}}"
		  isAutoComment="{{item.isAutoComment}}"
		  userHeadUrl="{{item.userHeadUrl}}"
		  specInfo="{{item.specInfo}}"
		  sellerReply="{{item.sellerReply || ''}}"
		  goodsDetailInfo="{{item.goodsDetailInfo || ''}}"
		/>
	</block>
	<t-load-more
	  t-class="no-more [padding-left:20rpx] [padding-right:20rpx]"
	  status="{{loadMoreStatus}}"
	  no-more-text="没有更多了"
	  color="#BBBBBB"
	  failedColor="#FA550F"
	/>
</view>

</template>

<json>
{
  "navigationBarTitleText": "全部评价",
  "usingComponents": {
    "t-tag": "tdesign-miniprogram/tag/tag",
    "comments-card": "./components/comments-card/index",
    "t-load-more": "/components/load-more/index"
  }
}
</json>
