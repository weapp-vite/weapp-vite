const require_common = require("../../common.js");
var now = require_common.dayjs_default();
Page({
	data: {
		shared: require_common.buildSharedMessage("packageA"),
		formattedNow: now.format("YYYY-MM-DD HH:mm:ss"),
		tomorrow: now.add(1, "day").format("YYYY-MM-DD")
	},
	onLoad() {
		console.log("packageA foo loaded");
	}
});
