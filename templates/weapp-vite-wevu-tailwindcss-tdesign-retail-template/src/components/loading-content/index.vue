<script lang="ts">
Component({
  externalClasses: ['wr-class'],
  properties: {
    position: {
      type: String,
      value: 'static',
    },
    noMask: Boolean,
    type: {
      type: String,
      value: 'circular',
    },
    vertical: Boolean,
    size: {
      type: String,
      value: '50rpx',
    },
    backgroundColor: {
      type: String,
      value: 'rgba(0, 0, 0, .6)',
    },
  },
});
</script>

<template>
<view class="t-class loading-content {{position}} [width:100%] [height:100%] [background-color:rgba(0,_0,_0,_0.6)] [position:relative] [&_.absolute]:[position:absolute] [&_.absolute]:[z-index:1] [&_.absolute]:[left:0] [&_.absolute]:[top:0] [&_.fixed]:[position:fixed] [&_.fixed]:[z-index:1] [&_.fixed]:[left:0] [&_.fixed]:[top:0] [&_.loading]:[width:100%] [&_.loading]:[height:100%] [&_.loading]:[visibility:visible]" style="{{(position === 'static' || noMask) ? 'visibility: hidden;' : ''}} background-color: {{backgroundColor}}">
	<t-loading
	 t-class="loading"
	 theme="{{type}}"
	 layout="{{vertical}}"
	 size="{{size}}"
	>
		<slot/>
	</t-loading>
</view>

</template>

<json>
{
  "component": true,
  "usingComponents": {
    "t-loading": "tdesign-miniprogram/loading/loading"
  }
}
</json>
