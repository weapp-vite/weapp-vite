// 本文件由 components.json 自动生成，请勿直接编辑。
/* eslint-disable style/comma-dangle, style/quote-props, style/quotes */

export const WEAPP_BUILTIN_HTML_TAGS_MEDIA_PLAYBACK = [
  {
    "name": "audio",
    "description": "音频。",
    "attributes": [
      {
        "name": "author",
        "description": "Type: string\n默认控件上的作者名字，如果 controls 属性值为 false 则设置 author 无效\nDefault: 未知作者"
      },
      {
        "name": "bindended",
        "description": "Type: function => any\n当播放到末尾时触发 ended 事件"
      },
      {
        "name": "binderror",
        "description": "Type: function => any\n当发生错误时触发 error 事件，detail = {errMsg: MediaError.code}\nMediaError.code: {1 => \"获取资源被用户禁止\"; 2 => \"网络错误\"; 3 => \"解码错误\"; 4 => \"不合适资源\"}"
      },
      {
        "name": "bindpause",
        "description": "Type: function => any\n当暂停播放时触发 pause 事件"
      },
      {
        "name": "bindplay",
        "description": "Type: function => any\n当开始/继续播放时触发play事件"
      },
      {
        "name": "bindtimeupdate",
        "description": "Type: function => any\n当播放进度改变时触发 timeupdate 事件，detail = {currentTime, duration}"
      },
      {
        "name": "controls",
        "description": "Type: boolean\n是否显示默认控件\nDefault: false"
      },
      {
        "name": "id",
        "description": "Type: string\naudio 组件的唯一标识符"
      },
      {
        "name": "loop",
        "description": "Type: boolean\n是否循环播放\nDefault: false"
      },
      {
        "name": "name",
        "description": "Type: string\n默认控件上的音频名字，如果 controls 属性值为 false 则设置 name 无效\nDefault: 未知音频"
      },
      {
        "name": "poster",
        "description": "Type: string\n默认控件上的音频封面的图片资源地址，如果 controls 属性值为 false 则设置 poster 无效"
      },
      {
        "name": "src",
        "description": "Type: string\n要播放音频的资源地址"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/audio.html"
      }
    ]
  },
  {
    "name": "image",
    "description": "图片。",
    "attributes": [
      {
        "name": "binderror",
        "description": "Type: function => any\n当错误发生时，发布到 AppService 的事件名，事件对象event.detail = {errMsg: 'something wrong'}"
      },
      {
        "name": "bindload",
        "description": "Type: function => any\n当图片载入完毕时，发布到 AppService 的事件名，事件对象event.detail = {height:'图片高度px', width:'图片宽度px'}"
      },
      {
        "name": "lazy-load",
        "description": "Type: boolean\n图片懒加载。只针对page与scroll-view下的image有效\nDefault: false\nSince: 1.5.0"
      },
      {
        "name": "mode",
        "description": "Type: string\n图片裁剪、缩放的模式\nDefault: 'scaleToFill'",
        "values": [
          {
            "name": "scaleToFill",
            "description": "缩放: 不保持纵横比缩放图片，使图片的宽高完全拉伸至填满 image 元素"
          },
          {
            "name": "aspectFit",
            "description": "缩放: 保持纵横比缩放图片，使图片的长边能完全显示出来。也就是说，可以完整地将图片显示出来。"
          },
          {
            "name": "aspectFill",
            "description": "缩放: 保持纵横比缩放图片，只保证图片的短边能完全显示出来。也就是说，图片通常只在水平或垂直方向是完整的，另一个方向将会发生截取。"
          },
          {
            "name": "widthFix",
            "description": "缩放: 宽度不变，高度自动变化，保持原图宽高比不变"
          },
          {
            "name": "heightFix",
            "description": "缩放模式，高度不变，宽度自动变化，保持原图宽高比不变"
          },
          {
            "name": "top",
            "description": "裁剪: 不缩放图片，只显示图片的顶部区域"
          },
          {
            "name": "bottom",
            "description": "裁剪: 不缩放图片，只显示图片的底部区域"
          },
          {
            "name": "center",
            "description": "裁剪: 不缩放图片，只显示图片的中间区域"
          },
          {
            "name": "left",
            "description": "裁剪: 不缩放图片，只显示图片的左边区域"
          },
          {
            "name": "right",
            "description": "裁剪: 不缩放图片，只显示图片的右边区域"
          },
          {
            "name": "top left",
            "description": "裁剪: 不缩放图片，只显示图片的左上边区域"
          },
          {
            "name": "top right",
            "description": "裁剪: 不缩放图片，只显示图片的右上边区域"
          },
          {
            "name": "bottom left",
            "description": "裁剪: 不缩放图片，只显示图片的左下边区域"
          },
          {
            "name": "bottom right",
            "description": "裁剪: 不缩放图片，只显示图片的右下边区域"
          }
        ]
      },
      {
        "name": "src",
        "description": "Type: string\n图片资源地址，支持云文件ID（2.2.3起）"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/image.html"
      }
    ]
  },
  {
    "name": "video",
    "description": "视频。该组件是[原生组件](https://developers.weixin.qq.com/miniprogram/dev/component/native-component.html)，使用时请注意相关限制。\n\n`<video />` 默认宽度300px、高度225px，可通过wxss设置宽高。",
    "attributes": [
      {
        "name": "ad-unit-id",
        "description": "Type: string\n视频前贴广告单元ID，更多详情可参考开放能力视频前贴广告\nSince: 2.8.1"
      },
      {
        "name": "auto-pause-if-navigate",
        "description": "Type: boolean\n当跳转到本小程序的其他页面时，是否自动暂停本页面的视频播放\nDefault: true\nSince: 2.5.0"
      },
      {
        "name": "auto-pause-if-open-native",
        "description": "Type: boolean\n当跳转到其它微信原生页面时，是否自动暂停本页面的视频\nDefault: true\nSince: 2.5.0"
      },
      {
        "name": "autoplay",
        "description": "Type: boolean\n是否自动播放\nDefault: false"
      },
      {
        "name": "background-poster",
        "description": "Type: string\n进入后台音频播放后的通知栏图标（Android 独有）\nSince: 2.14.3"
      },
      {
        "name": "bindcontrolstoggle",
        "description": "Type: function => any\n切换 controls 显示隐藏时触发。event.detail = {show}\nSince: 2.9.5"
      },
      {
        "name": "bindended",
        "description": "Type: function => any\n当播放到末尾时触发 ended 事件"
      },
      {
        "name": "bindenterpictureinpicture",
        "description": "Type: function => any\n播放器进入小窗\nSince: 2.11.0"
      },
      {
        "name": "binderror",
        "description": "Type: function => any\n视频播放出错时触发\nSince: 1.7.0"
      },
      {
        "name": "bindfullscreenchange",
        "description": "Type: function => any\n视频进入和退出全屏时触发，event.detail = {fullScreen, direction}，direction取为 vertical 或 horizontal\nSince: 1.4.0"
      },
      {
        "name": "bindleavepictureinpicture",
        "description": "Type: function => any\n播放器退出小窗\nSince: 2.11.0"
      },
      {
        "name": "bindloadedmetadata",
        "description": "Type: function => any\n视频元数据加载完成时触发。event.detail = {width, height, duration}\nSince: 2.7.0"
      },
      {
        "name": "bindpause",
        "description": "Type: function => any\n当暂停播放时触发 pause 事件"
      },
      {
        "name": "bindplay",
        "description": "Type: function => any\n当开始/继续播放时触发play事件"
      },
      {
        "name": "bindprogress",
        "description": "Type: function => any\n加载进度变化时触发，只支持一段加载。event.detail = {buffered}，百分比\nSince: 2.4.0"
      },
      {
        "name": "bindseekcomplete",
        "description": "Type: function => any\nseek 完成时触发 (position iOS 单位 s, Android 单位 ms)\nSince: 2.12.0"
      },
      {
        "name": "bindtimeupdate",
        "description": "Type: function => any\n播放进度变化时触发，event.detail = {currentTime, duration} 。触发频率 250ms 一次"
      },
      {
        "name": "bindwaiting",
        "description": "Type: function => any\n视频出现缓冲时触发\nSince: 1.7.0"
      },
      {
        "name": "certificate-url",
        "description": "Type: string\nDRM 设备身份认证 url，仅 is-drm 为 true 时生效 (iOS)\nSince: 2.19.3"
      },
      {
        "name": "controls",
        "description": "Type: boolean\n是否显示默认播放控件（播放/暂停按钮、播放进度、时间）\nDefault: true"
      },
      {
        "name": "danmu-btn",
        "description": "Type: boolean\n是否显示弹幕按钮，只在初始化时有效，不能动态变更\nDefault: false"
      },
      {
        "name": "danmu-list",
        "description": "Type: ArrayObject\n弹幕列表"
      },
      {
        "name": "direction",
        "description": "Type: number\n设置全屏时视频的方向，不指定则根据宽高比自动判断。有效值为 0（正常竖向）, 90（屏幕逆时针90度）, -90（屏幕顺时针90度）\nSince: 1.7.0"
      },
      {
        "name": "duration",
        "description": "Type: number\n指定视频时长\nSince: 1.1.0"
      },
      {
        "name": "enable-auto-rotation",
        "description": "Type: boolean\n是否开启手机横屏时自动全屏，当系统设置开启自动旋转时生效\nDefault: false\nSince: 2.11.0"
      },
      {
        "name": "enable-danmu",
        "description": "Type: boolean\n是否展示弹幕，只在初始化时有效，不能动态变更\nDefault: false"
      },
      {
        "name": "enable-play-gesture",
        "description": "Type: boolean\n是否开启播放手势，即双击切换播放/暂停\nDefault: false\nSince: 2.4.0"
      },
      {
        "name": "enable-progress-gesture",
        "description": "Type: boolean\n是否开启控制进度的手势\nDefault: true\nSince: 1.9.0"
      },
      {
        "name": "initial-time",
        "description": "Type: number\n指定视频初始播放位置\nSince: 1.6.0"
      },
      {
        "name": "is-drm",
        "description": "Type: boolean\n是否是 DRM 视频源\nSince: 2.19.3"
      },
      {
        "name": "license-url",
        "description": "Type: string\nDRM 获取加密信息 url，仅 is-drm 为 true 时生效\nSince: 2.19.3"
      },
      {
        "name": "loop",
        "description": "Type: boolean\n是否循环播放\nDefault: false\nSince: 1.4.0"
      },
      {
        "name": "muted",
        "description": "Type: boolean\n是否静音播放\nDefault: false\nSince: 1.4.0"
      },
      {
        "name": "object-fit",
        "description": "Type: string\n当视频大小与 video 容器大小不一致时，视频的表现形式。contain：包含，fill：填充，cover：覆盖\nDefault: contain"
      },
      {
        "name": "page-gesture",
        "description": "Type: boolean\n在非全屏模式下，是否开启亮度与音量调节手势\nDefault: false\nSince: 1.6.0"
      },
      {
        "name": "picture-in-picture-mode",
        "description": "Type: string/Array\n设置小窗模式： push, pop，空字符串或通过数组形式设置多种模式（如： [\"push\", \"pop\"]）\nSince: 2.11.0"
      },
      {
        "name": "picture-in-picture-show-progress",
        "description": "Type: boolean\n是否在小窗模式下显示播放进度\nDefault: false\nSince: 2.11.0"
      },
      {
        "name": "play-btn-position",
        "description": "Type: string\n播放按钮的位置\nDefault: bottom\nSince: 2.4.0"
      },
      {
        "name": "poster",
        "description": "Type: string\n视频封面的图片网络资源地址或云文件ID（2.2.3起支持）如果 controls 属性值为 false 则设置 poster 无效"
      },
      {
        "name": "poster-for-crawler",
        "description": "Type: string\n用于给搜索等场景作为视频封面展示，建议使用无播放 icon 的视频封面图，只支持网络地址"
      },
      {
        "name": "provision-url",
        "description": "Type: string\nDRM 设备身份认证 url，仅 is-drm 为 true 时生效 (Android)\nSince: 2.19.3"
      },
      {
        "name": "referrer-policy",
        "description": "Type: string\n格式固定为 https://servicewechat.com/{appid}/{version}/page-frame.html，其中 {appid} 为小程序的 appid，{version} 为小程序的版本号，版本号为 0 表示为开发版、体验版以及审核版本，版本号为 devtools 表示为开发者工具，其余为正式版本；\nDefault: no-referrer\nSince: 2.13.0"
      },
      {
        "name": "show-background-playback-button",
        "description": "Type: boolean\n是否展示后台音频播放按钮\nDefault: false\nSince: 2.14.3"
      },
      {
        "name": "show-casting-button",
        "description": "Type: boolean\n显示投屏按钮。安卓在同层渲染下生效，支持 DLNA 协议；iOS 支持 AirPlay 和 DLNA 协议\nDefault: false\nSince: 2.10.2"
      },
      {
        "name": "show-center-play-btn",
        "description": "Type: boolean\n是否显示视频中间的播放按钮\nDefault: true\nSince: 1.9.0"
      },
      {
        "name": "show-fullscreen-btn",
        "description": "Type: boolean\n是否显示全屏按钮\nDefault: true\nSince: 1.9.0"
      },
      {
        "name": "show-mute-btn",
        "description": "Type: boolean\n是否显示静音按钮\nDefault: false\nSince: 2.4.0"
      },
      {
        "name": "show-play-btn",
        "description": "Type: boolean\n是否显示视频底部控制栏的播放按钮\nDefault: true\nSince: 1.9.0"
      },
      {
        "name": "show-progress",
        "description": "Type: boolean\n若不设置，宽度大于240时才会显示\nDefault: true\nSince: 1.9.0"
      },
      {
        "name": "show-screen-lock-button",
        "description": "Type: boolean\n是否显示锁屏按钮，仅在全屏时显示，锁屏后控制栏的操作\nDefault: false\nSince: 2.11.0"
      },
      {
        "name": "show-snapshot-button",
        "description": "Type: boolean\n是否显示截屏按钮，仅在全屏时显示\nDefault: false\nSince: 2.13.0"
      },
      {
        "name": "src",
        "description": "Type: string\n要播放视频的资源地址，支持云文件ID（2.2.3起）"
      },
      {
        "name": "title",
        "description": "Type: string\n视频的标题，全屏时在顶部展示\nSince: 2.4.0"
      },
      {
        "name": "vslide-gesture",
        "description": "Type: boolean\n在非全屏模式下，是否开启亮度与音量调节手势（同 page-gesture）\nDefault: false\nSince: 2.6.2"
      },
      {
        "name": "vslide-gesture-in-fullscreen",
        "description": "Type: boolean\n在全屏模式下，是否开启亮度与音量调节手势\nDefault: true\nSince: 2.6.2"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/video.html"
      }
    ]
  }
]
