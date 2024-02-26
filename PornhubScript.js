
const URL_BASE = "https://www.pornhub.com";

const PLATFORM_CLAIMTYPE = 3;

const PLATFORM = "PornHub";

var config = {};
// session token
var token = "";
// headers (including cookie by default, since it's used for each session later)
var headers = {"Cookie": ""};

/**
 * Build a query
 * @param {{[key: string]: any}} params Query params
 * @returns {String} Query string
 */
function buildQuery(params) {
	let query = "";
	let first = true;
	for (const [key, value] of Object.entries(params)) {
		if (value) {
			if (first) {
				first = false;
			} else {
				query += "&";
			}

			query += `${key}=${value}`;
		}
	}

	return (query && query.length > 0) ? `?${query}` : ""; 
}


//Source Methods
source.enable = function (conf) {
	config = conf ?? {};
};

source.getHome = function () {
	return getVideoPager('/video', {}, 1);
};



source.searchSuggestions = function(query) {
	if(query.length < 1) return [];
	var json = JSON.parse(getPornhubContentData(URL_BASE + "/video/search_autocomplete?pornstars=true&token=" + token + "&orientation=straight&q=" + query + "&alt=0"));
	if (json.length == 0) return [];
	var suggestions = json.queries;
	// var suggestions = json.channels.forEach((m) => {
	// 	return m.name
	// });
	return suggestions
};

source.getSearchCapabilities = () => {
	return {
		types: [Type.Feed.Mixed],
		sorts: [Type.Order.Chronological],
		filters: []
	};
};

// KEEP
source.search = function (query, type, order, filters) {
	//let sort = order;
	//if (sort === Type.Order.Chronological) {
	//	sort = "-publishedAt";
	//}
//
	//const params = {
	//	search: query,
	//	sort
	//};
//
	//if (type == Type.Feed.Streams) {
	//	params.isLive = true;
	//} else if (type == Type.Feed.Videos) {
	//	params.isLive = false;
	//}

	return getVideoPager("/video/search", {search: query}, 1);
};

source.getSearchChannelContentsCapabilities = function () {
	return {
		types: [Type.Feed.Mixed],
		sorts: [Type.Order.Chronological],
		filters: []
	};
};

source.searchChannelContents = function (channelUrl, query, type, order, filters) {
	throw new ScriptException("This is a sample");

	//return get
};

source.searchChannels = function (query) {

	// todo not working?
	return getChannelPager('/channels/search', {channelSearch: query}, 1);
};


// KEEP
source.isChannelUrl = function (url) {
	return url.includes("/model/") || url.includes("/channels/") || url.includes("/pornstar/");
};

// KEEP
source.getChannel = function (url) {

   // /** @type {import("./types.d.ts").Channel} */
    //const j = getPornstarInfo(URL_BASE + url);
	if (!url.startsWith("htt")) {
		url = URL_BASE + url;
	}

	var channelUrlName = url.split("/")[4]

	const j = getChannelInfo(url);

    return new PlatformChannel({
        id: new PlatformID(PLATFORM, channelUrlName, config.id, PLATFORM_CLAIMTYPE),
        name: j.channelName,
        thumbnail: j.channelThumbnail,
        banner: j.channelBanner,
        subscribers: j.channelSubscribers,
        description: j.channelDescription,
        url: j.channelUrl,
        links: j.channelLinks,
    })
}



source.getChannelContents = function (url, type, order, filters) {
	return getChannelVideosPager(url + "/videos", {}, 1);
};


source.isContentDetailsUrl = function(url) {
	return url.startsWith(URL_BASE + "/view_video.php?viewkey=");
};




const supportedResolutions = {
	//'1080p': { width: 1920, height: 1080 },
	'720p': { width: 1280, height: 720 },
	'480p': { width: 854, height: 480 },
	'360p': { width: 640, height: 360 },
	'144p': { width: 256, height: 144 }
};



// TODO improve
source.getContentDetails = function (url) {

	var html = getPornhubContentData(url);

	let flashvarsMatch = html.match(/var\s+flashvars_\d+\s*=\s*({.+?});/);
	let flashvars = {};
	if (flashvarsMatch) {
		flashvars = JSON.parse(flashvarsMatch[1]);
	}

	var mediaDefinitions = flashvars["mediaDefinitions"];

	var sources = []

	for (const mediaDefinition of mediaDefinitions) {
		sources.push(new HLSSource({
			name: "HLS",
			url: mediaDefinition.videoUrl,
			duration: flashvars.video_duration ?? 0,
			priority: true
		}));


		// non funzia????
		if (mediaDefinition.videoUrl.includes("get_media")) {
			sources.push(new VideoUrlSource({
				name: "mp4",
				url: mediaDefinition.videoUrl,
				width: supportedResolutions["720p"].width,
				height: supportedResolutions["720p"].height,
				duration: flashvars.video_duration,
				container: "video/mp4"
			}));
		}

	}


	var dom = domParser.parseFromString(html);

	var ldJson = JSON.parse(dom.querySelector('script[type="application/ld+json"]').text)

	var description = ldJson.description;

	var userAvatar = dom.getElementsByClassName("userAvatar")[0].querySelector("img").getAttribute("src")

	var userInfoNode = dom.getElementsByClassName("userInfo")[0];

	var channelUrlId = userInfoNode.querySelector("div.usernameWrap a").getAttribute("href")[2]
	
	var subscribersStr = userInfoNode.querySelectorAll("span")[2].text;
	var subscribers = parseStringWithKorMSuffixes(subscribersStr);
	var displayName = userInfoNode.querySelector("a").text;
	var channelUrl = userInfoNode.querySelector("a").getAttribute("href");


	var views = parseInt(ldJson.interactionStatistic[0].userInteractionCount.replace("/", ""))

	var videoId = flashvars.playbackTracking.video_id.toString();

	// note: subtitles are in https://www.pornhub.com/video/caption?id={videoId}&language_id=1&caption_type=0 if present
 
	return new PlatformVideoDetails({
		id: new PlatformID(PLATFORM, videoId, config.id),
		name: flashvars.video_title,
		thumbnails: new Thumbnails([new Thumbnail(flashvars.image_url, 0)]),
		author: new PlatformAuthorLink(new PlatformID(PLATFORM, channelUrlId, config.id), //obj.channel.name, config.id), 
			displayName,//obj.channel.displayName, 
			channelUrl,//obj.channel.url,
			userAvatar ?? "",
			subscribers ?? ""),//obj.channel.avatar ? `${plugin.config.constants.baseUrl}${obj.channel.avatar.path}` : ""),
		datetime: Math.round((new Date(ldJson.uploadDate)).getTime() / 1000),
		duration: flashvars.video_duration,
		viewCount: views,
		url: flashvars.link_url,
		isLive: false,
		description: description,
		video: new VideoSourceDescriptor(sources),
		//subtitles: subtitles
	});
};



// the only things you need for a valid session are as follows:
// 1.) token
// 2.) cookie labeled "ss" in headers
// this will allow you to get search suggestions!!
function refreshSession() {
	const resp = http.GET(URL_BASE, {});
	if (!resp.isOk)
		throw new ScriptException("Failed request [" + URL_BASE + "] (" + resp.code + ")");
	else {
		var dom = domParser.parseFromString(resp.body);
		// the token is found here
		token = dom.querySelector("#searchInput").getAttribute("data-token");
		// and the data for the ss cookie is found here
		const adContextInfo = dom.querySelector("meta[name=\"adsbytrafficjunkycontext\"]").getAttribute("data-info");
		headers["Cookie"] = `ss=${JSON.parse(adContextInfo)["session_id"]}`
		log("New session created")
	}
}

function getVideoId(dom) {
	var videoId =  dom.querySelector("div#player").getAttribute("data-video-id");
	return videoId
}

//Comments
source.getComments = function (url) {
	var html = getPornhubContentData(url);
	var dom = domParser.parseFromString(html);
	var videoId = getVideoId(dom);
	if(token == "") refreshSession();
	return getCommentPager(`/comment/show?id=${videoId}&popular=0&what=video&token=${token}`, {}, 1);
}


source.getSubComments = function (comment) {
	//todo
	throw new ScriptException("This is a sample");
}

function parseStringWithKorMSuffixes(subscriberString) {
    const numericPart = parseFloat(subscriberString);

    if (subscriberString.includes("K")) {
        return Math.floor(numericPart * 1000);
    } else if (subscriberString.includes("M")) {
        return Math.floor(numericPart * 1000000);
    } else {
        // If there's no "K" or "M", assume the number is already in the desired format
        return Math.floor(numericPart);
    }
}




function getCommentPager(path, params, page) {
	log(`getVideoPager page=${page}`, params)

	const count = 10;
	const start = (page ?? 1) * count;
	params = { ... params, page }

	const url = URL_BASE + path;
	const urlWithParams = `${url}${buildQuery(params)}`;

	var html = getPornhubContentData(urlWithParams);

	var comments = getComments(html);

	return new PornhubCommentPager(comments.comments.map(c => {
		return new Comment({
			author: new PlatformAuthorLink(new PlatformID(PLATFORM, c.username, config.id), 
				c.username, 
				"", 
				c.avatar,
				"",),
			message: c.message,
			rating: new RatingLikesDislikes(c.voteUp, c.voteDown),
			date: Math.round(c.date.getTime() / 1000),
			replyCount: c.totalReplies,
			context: { id: c.id }
		});
	}), comments.total > (start + count), path, params, page);
}




function getComments(html) {

	var dom = domParser.parseFromString(html);

	var comments = []

	var total = parseInt(dom.querySelector("div#cmtWrapper div.cmtHeader h2 span").text.replace("(", "").replace(")", ""));
	if (total > 0) {
		// Loop through each comment block
		// todo nested blocks
		dom.querySelectorAll('div#cmtContent div.commentBlock').forEach(commentBlock => {
			const id = commentBlock.getAttribute("class").match(/commentTag(\d+)/)[1];

			const avatar = commentBlock.querySelector("img").getAttribute("src");
			const username = commentBlock.querySelector('a.usernameLink').text.trim();
			const date = parseRelativeDate(commentBlock.querySelector('div.date').text.trim());
			const message = commentBlock.querySelector('.commentMessage span').text.trim();
			const voteUp = parseInt(commentBlock.querySelector('span.voteTotal').text.trim());
			var isVoteDownPresent = commentBlock.querySelectorAll('div.actionButtonsBlock span') !== null;

			var voteDown = 0;
			if (isVoteDownPresent) {
				voteDown = parseInt(commentBlock.querySelectorAll('div.actionButtonsBlock span')[1].text.trim());
			}
		

			// Push comment details to the comments array
			comments.push({
				id,
				avatar,
				username,
				date,
				message,
				voteUp,
				voteDown
			});
		});


		return {
			total: total,
			comments: comments
		};

	} else {

		return {
			total: 0,
			comments: 0
		};
	}

}


function parseRelativeDate(relativeDate) {
    const now = new Date();
    const lowerCaseRelativeDate = relativeDate.toLowerCase();

    if (lowerCaseRelativeDate.includes('1 second ago')) {
        return new Date(now - 1000);
    } else if (lowerCaseRelativeDate.includes('1 minute ago')) {
        return new Date(now - 60 * 1000);
    } else if (lowerCaseRelativeDate.includes('1 hour ago')) {
        return new Date(now - 60 * 60 * 1000);
    } else if (lowerCaseRelativeDate.includes('1 day ago')) {
        return new Date(now - 24 * 60 * 60 * 1000);
    } else if (lowerCaseRelativeDate.includes('yesterday')) {
        return new Date(now - 24 * 60 * 60 * 1000);
    } else if (lowerCaseRelativeDate.includes('1 week ago')) {
        return new Date(now - 7 * 24 * 60 * 60 * 1000);
    } else if (lowerCaseRelativeDate.includes('1 month ago')) {
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(now.getMonth() - 1);
        return oneMonthAgo;
    } else if (lowerCaseRelativeDate.includes('1 year ago')) {
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(now.getFullYear() - 1);
        return oneYearAgo;
    } else if (lowerCaseRelativeDate.includes('seconds ago')) {
        const secondsAgo = parseInt(lowerCaseRelativeDate);
        return new Date(now - secondsAgo * 1000);
    } else if (lowerCaseRelativeDate.includes('minutes ago')) {
        const minutesAgo = parseInt(lowerCaseRelativeDate);
        return new Date(now - minutesAgo * 60 * 1000);
    } else if (lowerCaseRelativeDate.includes('hours ago')) {
        const hoursAgo = parseInt(lowerCaseRelativeDate);
        return new Date(now - hoursAgo * 60 * 60 * 1000);
    } else if (lowerCaseRelativeDate.includes('days ago')) {
        const daysAgo = parseInt(lowerCaseRelativeDate);
        return new Date(now - daysAgo * 24 * 60 * 60 * 1000);
    } else if (lowerCaseRelativeDate.includes('weeks ago')) {
        const weeksAgo = parseInt(lowerCaseRelativeDate);
        return new Date(now - weeksAgo * 7 * 24 * 60 * 60 * 1000);
    } else if (lowerCaseRelativeDate.includes('months ago')) {
        const monthsAgo = parseInt(lowerCaseRelativeDate);
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(now.getMonth() - monthsAgo);
        return oneMonthAgo;
    } else if (lowerCaseRelativeDate.includes('years ago')) {
        const yearsAgo = parseInt(lowerCaseRelativeDate);
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(now.getFullYear() - yearsAgo);
        return oneYearAgo;
    }

    // Handle additional cases or return null if the format is not recognized
    return 0;
}







function getChannelInfo22(url) {
	var html = getPornhubContentData(url);
	let dom = domParser.parseFromString(html);

	var channelName = ""

	var channelSubscribers = 0

	var channelViews = 0

	// Find the ul element with id "singleFeedSection"
	var avatarPictureNode = dom.getElementById("avatarPicture");

	var channelThumbnail = dom.getElementById("getAvatar").getAttribute("src");

	var h1Name = dom.querySelector("bottomExtendedWrapper clearfix").querySelector("h1");
	//if (h1Name.getAttribute("itemprop") == "name") {
		channelName = h1Name.text
	//}

	var channelBanner = dom.getElementById("coverPictureDefault");//avatarPictureNode.parentNode.getElementById("coverPictureDefault").getAttribute("src");

	var infoBoxesNodes = avatarPictureNode.parentNode.getElementsByClassName("infoBoxes");

	infoBoxesNodes.forEach(node => {

		var attributeDataTitle = node.getAttribute("data-title");
		if (attributeDataTitle.includes("Subscribers: ")) {
			var subscriberStr = attributeDataTitle.indexOf("Subscribers: ");
			channelSubscribers = parseInt(subscriberStr.replace(/,/g, ''));
		}
		if (attributeDataTitle.includes("Video views: ")) {
			var viewsStr = attributeDataTitle.indexOf("Video views: ");
			channelViews = parseInt(viewsStr.replace(/,/g, ''));
		}
	});

	var channelDescription = ""

	var channelLinks = []

	return {
		channelName: channelName,
		channelThumbnail: channelThumbnail,
		channelBanner: channelBanner,
		channelSubscribers: channelSubscribers,
		channelDescription: channelDescription,
		channelUrl: channelUrl,
		channeLinks: channelLinks
	}
}





// todo forse va bene per pornstar??
//function getChannelContents(url, ulElement) {
//	var html = getPornhubContentData(url);
//	let dom = domParser.parseFromString(html);
//	
//
//	var channelLinks = dom.getElementById(ulElement).childNodes.forEach((li) => {
//
//
//
//		return li.querySelector("a").getAttribute("href");
//	});
//
//
//	let node = domParser.parseFromString(html, "text/html");
//	
//	// Find the ul element with id ulId
//	var ulElement = node.getElementById(ulId);
//
//	var pagingIndication = node.getElementsByClassName("showingCounter")[0].text;
//	var indexOfTotalStr = pagingIndication.indexOf("of "); // "showing XX-ZZ of TOTAL"
//	var total = parseInt(pagingIndication.substring(indexOfTotalStr + 3), 10);
//
//	var resultArray = []
//
//	// Check if the ul element with id "singleFeedSection" exists
//	if (ulElement) {
//		// Get all li elements inside the ul
//		var liElements = ulElement.querySelectorAll("li");
//
//		// Iterate through each li element
//		liElements.forEach(function (li) {
//
//			// Get the id attribute of the li element
//			var liId = li.getAttribute("id");
//
//			// Check if the id starts with "v" and is followed by digits only
//
//			if (liId != "") {
//				// Find the first <a> tag inside the li
//				var aElement = li.querySelector('a');
//
//				var viewsStr = li.getElementsByClassName("videoDetailsBlock")[0].getElementsByClassName("views")[0].text
//				var views = parseViewsSuffix(viewsStr);
//
//				var authorInfoNode = li.getElementsByClassName("usernameWrap")[0].firstChild;
//
//				var authorInfo = {
//					channel: URL_BASE + authorInfoNode.getAttribute("href"),
//					authorName: authorInfoNode.text
//				}
//
//				// Check if an <a> tag is found
//				if (aElement) {
//
//					//var duration = li.querySelectorAll("var").
//					var durationStr = aElement.getElementsByClassName("duration")[0].text;
//					var duration = parseDuration(durationStr);
//
//					// Get the "href" attribute as "videoUrl"
//					var videoUrl = URL_BASE + aElement.getAttribute('href');
//
//					// Find the <img> tag inside the <a>
//					var imgElement = aElement.querySelector('img');
//
//					// Check if an <img> tag is found
//					if (imgElement) {
//						// Get the "src" attribute as "thumbnailUrl"
//						var thumbnailUrl = imgElement.getAttribute('src');
//
//						// Title
//						var title = imgElement.getAttribute("alt");
//
//
//						var videoId = imgElement.getAttribute("data-video-id");
//
//						// Create an object with the desired properties and push it to the result array
//						resultArray.push({
//							id: videoId,
//							videoUrl: videoUrl,
//							title: title,
//							thumbnailUrl: thumbnailUrl,
//							duration: duration,
//							authorInfo: authorInfo,
//							views: views,
//						});
//					}
//				}
//			}
//		});
//	}
//
//	return {
//		totalElemsPages: total,
//		videos: resultArray
//	};
//
//}



function getChannelInfo(url) {
	var html = getPornhubContentData(url);
	let dom = domParser.parseFromString(html);

	var channelThumbnail = dom.getElementById("getAvatar").getAttribute("src");
	var channelBanner = dom.getElementById("coverPictureDefault").getAttribute("src");
	var channelName = dom.querySelector("h1").text;

	var statsNode = dom.getElementById("stats");
	
	var channelSubscribers = parseInt(statsNode.childNodes[1].text.replace(/,/g, ''));
	var channelViews = parseInt(statsNode.childNodes[0].text.replace(/,/g, ''));

	var channelDescription = dom.querySelector(".cdescriptions").childNodes[0].text


	return {
		channelName: channelName,
		channelThumbnail: channelThumbnail,
		channelBanner: channelBanner,
		channelSubscribers: channelSubscribers,
		channelDescription: channelDescription,
		channelUrl: url,
		channelLinks: []
	}
}



function getPornstarInfo(url) {
	var html = getPornhubContentData(url);
	let dom = domParser.parseFromString(html);

	var channelName = ""

	var channelSubscribers = 0

	var channelViews = 0

	// Find the ul element with id "singleFeedSection"
	var avatarPictureNode = dom.getElementById("avatarPicture");

	var channelThumbnail = avatarPictureNode.firstChild.firstChild.getAttribute("src");

	var h1Name = avatarPictureNode.parentNode.querySelector("h1");
	if (h1Name.getAttribute("itemprop") == "name") {
		channelName = h1Name.text
	}

	var channelBanner = avatarPictureNode.parentNode.getElementById("coverPictureDefault").getAttribute("src");

	var infoBoxesNodes = avatarPictureNode.parentNode.getElementsByClassName("infoBoxes");

	infoBoxesNodes.forEach(node => {

		var attributeDataTitle = node.getAttribute("data-title");
		if (attributeDataTitle.includes("Subscribers: ")) {
			var subscriberStr = attributeDataTitle.indexOf("Subscribers: ");
			channelSubscribers = parseInt(subscriberStr.replace(/,/g, ''));
		}
		if (attributeDataTitle.includes("Video views: ")) {
			var viewsStr = attributeDataTitle.indexOf("Video views: ");
			channelViews = parseInt(viewsStr.replace(/,/g, ''));
		}
	});



	//var channeViews = 

	var channelDescription = dom.querySelector("aboutMeSection sectionDimensions").childNodes[1].text;

	var channeLinks = []

	return {
		channelName: channelName,
		channelThumbnail: channelThumbnail,
		channelBanner: channelBanner,
		channelSubscribers: channelSubscribers,
		channelDescription: channelDescription,
		channelUrl: channelUrl,
		channelLinks: channeLinks
	}
}


// KEEP
class PornhubVideoPager extends VideoPager {
	constructor(results, hasMore, path, params, page) {
		super(results, hasMore, { path, params,  page});
	}
	
	nextPage() {
		return getVideoPager(this.context.path, this.context.params, (this.context.page ?? 1) + 1);
	}
}


// KEEP
class PornhubChannelVideosPager extends VideoPager {
	constructor(results, hasMore, path, params, page) {
		super(results, hasMore, { path, params,  page});
	}
	
	nextPage() {
		return getChannelVideosPager(this.context.path, this.context.params, (this.context.page ?? 1) + 1);
	}
}


// KEEP
class PornhubChannelPager extends ChannelPager {
	constructor(results, hasMore, path, params, page) {
		super(results, hasMore, { path, params, page });
	}
	
	nextPage() {
		return getChannelPager(this.context.path, this.context.params, (this.context.page ?? 1) + 1);
	}
}


// KEEP
class PornhubCommentPager extends CommentPager {
	constructor(results, hasMore, path, params, page) {
		super(results, hasMore, { path, params, page });
	}
	
	nextPage() {
		return getCommentPager(this.context.path, this.context.params, (this.context.page ?? 1) + 1);
	}
}




function getChannelPager(path, params, page) {

	log(`getVideoPager page=${page}`, params)

	const count = 36;
	const start = (page ?? 1) * count;
	params = { ... params, page }

	const url = URL_BASE + path;
	const urlWithParams = `${url}${buildQuery(params)}`;

	var html = getPornhubContentData(urlWithParams);

	var channels = getChannels(html, "searchChannelsSection");


	return new PornhubChannelPager(channels.channels.map(c => {
			return new PlatformAuthorLink(new PlatformID(PLATFORM, c.name, config.id), 
				c.displayName, 
				URL_BASE + c.url, 
				c.avatar ?? "",
				c.subscribers);
		}), channels.hasNextPage, path, params, page);
}

function getChannels(html) {

	var dom = domParser.parseFromString(html);

	var resultArray = []

	dom.getElementById("searchChannelsSection").childNodes.forEach((li) => {

			var avatar = li.querySelector("div.avatar a.usernameLink img").getAttribute("src");
			var displayName = li.querySelector("div.descriptionContainer li a.usernameLink").text;
			var url = li.querySelector("div.descriptionContainer li a.usernameLink").getAttribute("href");
			var subscribers = parseInt(li.querySelector("div.descriptionContainer li span").text.replace(/\,/, ""));
			var name = url.split("/")[1];

			resultArray.push({
				subscribers: subscribers,
				name: name,
				url: url,
				displayName: displayName,
				avatar: avatar,
			});
	});
	

	var hasNextPage = false; 
	var pageNextNode = dom.getElementsByClassName("page_next");
	if (pageNextNode.length > 0) {
		hasNextPage = pageNextNode[0].firstChild.getAttribute("href") == "" ? false : true;
	}

	return {
		hasNextPage: hasNextPage,
		channels: resultArray
	};
}



// todo: sort
function getChannelVideosPager(path, params, page) {

	log(`getVideoPager page=${page}`, params)

	const count = 36;
	const start = (page ?? 1) * count;
	params = { ... params, page }

	const url = path;
	const urlWithParams = `${url}${buildQuery(params)}`;

	var html = getPornhubContentData(urlWithParams);

	var vids = getChannelContents(html);


	return new PornhubChannelVideosPager(vids.videos.map(v => {
		return new PlatformVideo({
			id: new PlatformID(PLATFORM, v.id, config.id),
			name: v.title ?? "",
			thumbnails: new Thumbnails([new Thumbnail(v.thumbnailUrl, 0)]),
			author: new PlatformAuthorLink(new PlatformID(PLATFORM, v.authorInfo.authorName, config.id), 
				v.authorInfo.authorName, 
				path.split("/")[4],
				v.authorInfo.avatar),
			datetime: undefined,//Math.round((new Date(v.publishedAt)).getTime() / 1000),
			duration: v.duration,
			viewCount: v.views,
			url: URL_BASE + v.videoUrl,
			isLive: false
		});

	}), vids.totalElemsPages > (start + count), path, params, page);
}


function getChannelContents(html) {
	var dom = domParser.parseFromString(html);

	var statsNodes = dom.querySelectorAll("div#stats div.info.floatRight");

	var total = parseInt(statsNodes[2].text.replace(/,/g, ''));

	var resultArray = []

	var authorInfo = {
		authorName: dom.querySelector("div.title h1").text,
		avatar: dom.querySelector("img#getAvatar").getAttribute("href")
	}

	dom.getElementById("showAllChanelVideos").childNodes.forEach((li) => {

		var title = li.querySelector("span.title a").text;
		var videoUrl = li.querySelector("span.title a").getAttribute("href");
		var thumbnailUrl = li.querySelector("img").getAttribute("src");
		var videoId = li.getAttribute("data-video-id");
		var duration = parseDuration(li.querySelector("var.duration").text);
		var views = parseStringWithKorMSuffixes(li.querySelector("div.videoDetailsBlock span.views var").text)

		resultArray.push({
			id: videoId,
			videoUrl: videoUrl,
			title: title,
			thumbnailUrl: thumbnailUrl,
			duration: duration,
			authorInfo: authorInfo,
			views: views,
		});

	});

	return {
		totalElemsPages: total,
		videos: resultArray
	};
}


// todo: sort
function getVideoPager(path, params, page) {

	log(`getVideoPager page=${page}`, params)

	const count = 44;
	const start = (page ?? 1) * count;
	params = { ... params, page }

	const url = URL_BASE + path;
	const urlWithParams = `${url}${buildQuery(params)}`;

	var html = getPornhubContentData(urlWithParams);

	var vids = getVideos(html, "videoSearchResult");
	
	return new PornhubVideoPager(vids.videos.map(v => {
		return new PlatformVideo({
			id: new PlatformID(PLATFORM, v.id, config.id),
			name: v.title ?? "",
			thumbnails: new Thumbnails([new Thumbnail(v.thumbnailUrl, 0)]),
			author: new PlatformAuthorLink(new PlatformID(PLATFORM, v.authorInfo.authorName, config.id), 
				v.authorInfo.authorName, 
				v.authorInfo.channel,
				""),
			datetime: undefined,//Math.round((new Date(v.publishedAt)).getTime() / 1000),
			duration: v.duration,
			viewCount: v.views,
			url: v.videoUrl,
			isLive: false
		});

	}), vids.totalElemsPages > (start + count), path, params, page);
}


// KEEP
function getVideos(html, ulId) {

	let node = domParser.parseFromString(html, "text/html");
	
	// Find the ul element with id ulId
	var ulElement = node.getElementById(ulId);

	var pagingIndication = node.getElementsByClassName("showingCounter")[0].text;
	var indexOfTotalStr = pagingIndication.indexOf("of "); // "showing XX-ZZ of TOTAL"
	var total = parseInt(pagingIndication.substring(indexOfTotalStr + 3), 10);

	var resultArray = []

	// Check if the ul element with id "singleFeedSection" exists
	if (ulElement) {
		// Get all li elements inside the ul
		var liElements = ulElement.querySelectorAll("li");

		// Iterate through each li element
		liElements.forEach(function (li) {

			// Get the id attribute of the li element
			var liId = li.getAttribute("id");

			// Check if the id starts with "v" and is followed by digits only

			if (liId != "") {
				// Find the first <a> tag inside the li
				var aElement = li.querySelector('a');

				var viewsStr = li.getElementsByClassName("videoDetailsBlock")[0].getElementsByClassName("views")[0].text
				var views = parseViewsSuffix(viewsStr);

				var authorInfoNode = li.getElementsByClassName("usernameWrap")[0].firstChild;

				var authorInfo = {
					channel: URL_BASE + authorInfoNode.getAttribute("href"),
					authorName: authorInfoNode.text
				}

				// Check if an <a> tag is found
				if (aElement) {

					//var duration = li.querySelectorAll("var").
					var durationStr = aElement.getElementsByClassName("duration")[0].text;
					var duration = parseDuration(durationStr);

					// Get the "href" attribute as "videoUrl"
					var videoUrl = URL_BASE + aElement.getAttribute('href');

					// Find the <img> tag inside the <a>
					var imgElement = aElement.querySelector('img');

					// Check if an <img> tag is found
					if (imgElement) {
						// Get the "src" attribute as "thumbnailUrl"
						var thumbnailUrl = imgElement.getAttribute('src');

						// Title
						var title = imgElement.getAttribute("alt");


						var videoId = imgElement.getAttribute("data-video-id");

						// Create an object with the desired properties and push it to the result array
						resultArray.push({
							id: videoId,
							videoUrl: videoUrl,
							title: title,
							thumbnailUrl: thumbnailUrl,
							duration: duration,
							authorInfo: authorInfo,
							views: views,
						});
					}
				}
			}
		});
	}

	return {
		totalElemsPages: total,
		videos: resultArray
	};

}


function getPornhubContentData(url) {
	if(headers["Cookie"].length === 0) {
		refreshSession();
	}
	else {
		log("Session is good");
	}
	const resp = http.GET(url, headers);
	if (!resp.isOk)
		throw new ScriptException("Failed request [" + URL_BASE + "] (" + resp.code + ")");
	else {
		return resp.body
	}
}

function parseViewsSuffix(viewsStr) {

	var mul = 1;
	if (viewsStr.includes("K")) {
		mul = 1000;
	}
	if (viewsStr.includes("M")) {
		mul = 1000000;
	}

	var views = parseFloat(viewsStr.slice(0, -1)) * mul;
	return views;
}

function parseDuration(durationStr) {
	var splitted = durationStr.split(":");
	var mins = parseInt(splitted[0]);
	var secs = parseInt(splitted[1]);

	return 60 * mins + secs;
}




//function getVideosFirstPageNoSearch(html, ulId) {
//
//	let node = domParser.parseFromString(html);
//
//	
//	// Find the ul element with id ulId
//	var ulElement = node.getElementById(ulId);
//
//	var total = parseInt(ulElement.parentNode.getElementsByClassName("showingCounter")[0].text.indexOf("Subscribers: "));
//
//	var resultArray = []
//
//	// Check if the ul element with id "singleFeedSection" exists
//	if (ulElement) {
//		// Get all li elements inside the ul
//		var liElements = ulElement.querySelectorAll("li");
//
//		// Iterate through each li element
//		liElements.forEach(function (li) {
//
//			// Get the id attribute of the li element
//			var liId = li.getAttribute("id");
//
//			// Check if the id starts with "v" and is followed by digits only
//
//			if (liId != "") {
//				// Find the first <a> tag inside the li
//				var aElement = li.querySelector('a');
//
//				var viewsStr = li.getElementsByClassName("videoDetailsBlock")[0].getElementsByClassName("views")[0].text
//				var views = parseViewsSuffix(viewsStr);
//
//				var authorInfoNode = li.getElementsByClassName("usernameWrap")[0].firstChild;
//
//				var authorInfo = {
//					channel: URL_BASE + authorInfoNode.getAttribute("href"),
//					authorName: authorInfoNode.text
//				}
//
//				// Check if an <a> tag is found
//				if (aElement) {
//
//					//var duration = li.querySelectorAll("var").
//					var durationStr = aElement.getElementsByClassName("duration")[0].text;
//					var duration = parseDuration(durationStr);
//
//					// Get the "href" attribute as "videoUrl"
//					var videoUrl = URL_BASE + aElement.getAttribute('href');
//
//					// Find the <img> tag inside the <a>
//					var imgElement = aElement.querySelector('img');
//
//					// Check if an <img> tag is found
//					if (imgElement) {
//						// Get the "src" attribute as "thumbnailUrl"
//						var thumbnailUrl = imgElement.getAttribute('src');
//
//						// Title
//						var title = imgElement.getAttribute("alt");
//
//
//						var videoId = imgElement.getAttribute("data-video-id");
//
//						// Create an object with the desired properties and push it to the result array
//						resultArray.push({
//							id: videoId,
//							videoUrl: videoUrl,
//							title: title,
//							thumbnailUrl: thumbnailUrl,
//							duration: duration,
//							authorInfo: authorInfo,
//							views: views,
//						});
//					}
//				}
//			}
//		});
//	}
//
//	return {
//		totalElemsPages: total,
//		videos: resultArray
//	};
//
//}


log("LOADED");
