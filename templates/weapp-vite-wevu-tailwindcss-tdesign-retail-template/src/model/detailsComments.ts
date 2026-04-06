export function getGoodsDetailsComments(_spuId = 0) {
  return {
    homePageComments: [
      {
        spuId: '1722045',
        skuId: null,
        specInfo: null,
        commentContent:
          '收到货了，第一时间试了一下，很漂亮特别喜欢，大爱大爱，颜色也很好看。棒棒!',
        commentScore: 4,
        uid: '88881048075',
        userName: 'Dean',
        userHeadUrl:
          'https://wx.qlogo.cn/mmopen/vi_32/5mKrvn3ibyDNaDZSZics3aoKlz1cv0icqn4EruVm6gKjsK0xvZZhC2hkUkRWGxlIzOEc4600JkzKn9icOLE6zjgsxw/132',
      },
    ],
  }
}

export function getGoodsDetailsCommentsCount(_spuId = 0) {
  return {
    commentCount: '47',
    badCount: '0',
    middleCount: '2',
    goodCount: '45',
    hasImageCount: '1',
    goodRate: 95.7,
    uidCount: '0',
  }
}

export type GoodsDetailsComments = ReturnType<typeof getGoodsDetailsComments>
export type GoodsDetailsCommentsCount = ReturnType<typeof getGoodsDetailsCommentsCount>
