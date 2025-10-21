const require___weapp_shared___packageA_packageB_common = require("../__shared__/common.js");
var now = require___weapp_shared___packageA_packageB_common.dayjs_default();
Page({
	data: {
		shared: require___weapp_shared___packageA_packageB_common.buildSharedMessage("packageA"),
		formattedNow: now.format("YYYY-MM-DD HH:mm:ss"),
		tomorrow: now.add(1, "day").format("YYYY-MM-DD")
	},
	onLoad() {
		console.log("packageA foo loaded");
	}
});
