const URL_BASE = "https://www.pornhub.com";

const PLATFORM_CLAIMTYPE = 3;

const PLATFORM = "PornHub";

var config = {};
var state = {
	token: "",
	sessionCookie: ""
};

// headers (including cookie by default, since it's used for each session later)
var headers = {
	"Cookie": "platform=pc; accessAgeDisclaimerPH=2",
	"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0",
	"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
	"Accept-Language": "en-US,en;q=0.5",
	"Cache-Control": "no-cache",
	"Upgrade-Insecure-Requests": "1"
};

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
source.enable = function (conf, settings, savedStateStr) {
	config = conf ?? {};

	if (savedStateStr) {
		try {
			state = JSON.parse(savedStateStr);
			log("State loaded: token=" + (state.token ? "present" : "empty"));
		} catch (e) {
			log("Failed to parse saved state: " + e);
		}
	}
};

source.saveState = function() {
	return JSON.stringify(state);
};

source.getHome = function () {
	return getVideoPager('/video', {}, 1);
};



source.searchSuggestions = function(query) {
	if(query.length < 1) return [];

	try {
		// Build autocomplete API URL
		var apiUrl = URL_BASE + "/api/v1/video/search_autocomplete?pornstars=true&token=" + state.token + "&orientation=straight&q=" + encodeURIComponent(query) + "&alt=0";
		log("Fetching autocomplete: " + apiUrl);

		// Use httpGET with options object
		var json = httpGET(apiUrl, {
			headers: {
				"Cookie": headers["Cookie"],
				"User-Agent": headers["User-Agent"],
				"Accept": "*/*",
				"Accept-Language": "en-US,en;q=0.5",
				"Referer": URL_BASE + "/",
				"X-Requested-With": "XMLHttpRequest",
				"Content-Type": "application/x-www-form-urlencoded"
			},
			requireToken: true,
			parseJson: true,
			retries: 3
		});

		if (!json || json.length === 0) {
			log("Empty autocomplete JSON");
			return [];
		}

		var suggestions = [];

		// Add query suggestions
		if (json.queries && Array.isArray(json.queries)) {
			suggestions = suggestions.concat(json.queries);
		}

		// Add model names (prefixed with @)
		if (json.models && Array.isArray(json.models)) {
			json.models.forEach(function(model) {
				suggestions.push("@" + model.name);
			});
		}

		// Add pornstar names (prefixed with @)
		if (json.pornstars && Array.isArray(json.pornstars)) {
			json.pornstars.forEach(function(pornstar) {
				suggestions.push("@" + pornstar.name);
			});
		}

		// Add channel names (prefixed with #)
		if (json.channels && Array.isArray(json.channels)) {
			json.channels.forEach(function(channel) {
				suggestions.push("#" + channel.name);
			});
		}

		log("Autocomplete returned " + suggestions.length + " total suggestions");
		return suggestions;
	} catch(e) {
		log("Search suggestions failed: " + e);
		return [];
	}
};

source.getSearchCapabilities = () => {
	return {
		types: [Type.Feed.Mixed],
		sorts: [Type.Order.Chronological],
		filters: []
	};
};

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
};

source.searchChannels = function (query) {
	return getAutocompleteChannelPager(query);
};


source.isChannelUrl = function (url) {
	return (url.includes(".pornhub.com/model/") || url.includes(".pornhub.com/channels/") || url.includes(".pornhub.com/pornstar/") ||
			url.includes("/model/") || url.includes("/channels/") || url.includes("/pornstar/"));
};

source.getChannel = function (url) {
	if (!url.startsWith("htt")) {
		url = URL_BASE + url;
	}

	// Normalize the URL to remove country-specific subdomains
	url = normalizePornhubUrl(url);

	var channelUrlName = url.split("/")[4]

	var info;
	if(url.includes("/channels/")) {
		info = getChannelInfo(url);
	} else {
		info = getPornstarInfo(url);
	}

    return new PlatformChannel({
        id: new PlatformID(PLATFORM, channelUrlName, config.id, PLATFORM_CLAIMTYPE),
        name: info.channelName,
        thumbnail: info.channelThumbnail,
        banner: info.channelBanner,
        subscribers: info.channelSubscribers,
        description: info.channelDescription,
        url: info.channelUrl,
        links: info.channelLinks
    })
}



source.getChannelContents = function (url, type, order, filters) {
	// Normalize the URL to remove country-specific subdomains
	url = normalizePornhubUrl(url);

	// channels have different format than model/pornstar
	if(url.includes("/channels/")) {
		return getChannelVideosPager(url + "/videos", {}, 1);
	} else if(url.includes("/model/")){
		return getModelVideosPager(url + "/videos", {}, 1);
	} else {
		return getPornstarVideosPager(url + "/videos/upload", {}, 1);
	}
};


source.isContentDetailsUrl = function(url) {
	return url.includes(".pornhub.com/view_video.php?viewkey=") || url.includes("/view_video.php?viewkey=");
};

const supportedResolutions = {
	'1080': { width: 1920, height: 1080 },
	'720': { width: 1280, height: 720 },
	'480': { width: 854, height: 480 },
	'360': { width: 640, height: 360 },
	'240': { width: 352, height: 240 },
	'144': { width: 256, height: 144 }
};



source.getContentDetails = function (url) {
	var html = httpGET(url, {});

	let flashvarsMatch = html.match(/var\s+flashvars_\d+\s*=\s*({.+?});/);

	let flashvars = {};
	if (flashvarsMatch) {
		flashvars = JSON.parse(flashvarsMatch[1]);
	}

	var mediaDefinitions = flashvars["mediaDefinitions"];
	var sources = [];


	for (const mediaDefinition of mediaDefinitions) {
		if(typeof mediaDefinition.defaultQuality === "boolean") {
			if(typeof mediaDefinition.quality === "object") continue;
			let width = supportedResolutions[`${mediaDefinition.quality}`].width;
			let height = supportedResolutions[`${mediaDefinition.quality}`].height;
			sources.push(new HLSSource({
				name: `${width}x${height}`,
				width: width,
				height: height,
				url: mediaDefinition.videoUrl,
				duration: flashvars.video_duration ?? 0,
				priority: true
			}));
		} else if(typeof mediaDefinition.defaultQuality === "number") {
			// doesn't work for now
			// sources.push(new VideoUrlSource({
			// 	name: "mp4",
			// 	url: mediaDefinition.videoUrl,
			// 	width: supportedResolutions[mediaDefinition.defaultQuality].width,
			// 	height: supportedResolutions[mediaDefinition.defaultQuality].height,
			// 	duration: flashvars.video_duration,
			// 	container: "video/mp4"
			// }));
		} else {
			continue;
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


	var views = parseInt(ldJson.interactionStatistic[0].userInteractionCount.replace(/,/g, ""))

	var videoId = flashvars.playbackTracking.video_id.toString();

	// note: subtitles are in https://www.pornhub.com/video/caption?id={videoId}&language_id=1&caption_type=0 if present
 
	const details = new PlatformVideoDetails({
		id: new PlatformID(PLATFORM, videoId, config.id),
		name: flashvars.video_title,
		thumbnails: new Thumbnails([new Thumbnail(flashvars.image_url, 0)]),
		author: new PlatformAuthorLink(new PlatformID(PLATFORM, channelUrlId, config.id),
			displayName,
			channelUrl,
			userAvatar ?? "",
			subscribers ?? ""),
		datetime: Math.round((new Date(ldJson.uploadDate)).getTime() / 1000),
		duration: flashvars.video_duration,
		viewCount: views,
		url: flashvars.link_url,
		isLive: false,
		description: description,
		video: new VideoSourceDescriptor(sources),
		//subtitles: subtitles
	});

    details.getContentRecommendations = function () {
        return source.getContentRecommendations(url);
    };

	return details;
};

// Get content recommendations based on a video URL
source.getContentRecommendations = function(url) {
	var html = httpGET(url, {});
	var dom = domParser.parseFromString(html);

	// Find all li.pcVideoListItem in the page (these are related videos)
	var liElements = dom.querySelectorAll("li.pcVideoListItem");

	if (liElements.length === 0) {
		log("No recommendations found");
		return new ContentPager([], false);
	}

	var resultArray = [];

	liElements.forEach(function (li) {
		const videoId = li.getAttribute("data-video-id");
		if (videoId && !isNaN(videoId)) {
			const aElement = li.querySelector('a.thumbnailTitle, a[href*="view_video"]');
			if (aElement) {
				const videoUrl = aElement.getAttribute('href');
				const imgElement = li.querySelector('img');
				if (imgElement && videoUrl) {
					const thumbnailUrl = imgElement.getAttribute('src') || imgElement.getAttribute('data-src') || imgElement.getAttribute('data-thumb_url');
					const title = aElement.getAttribute("title") || aElement.textContent.trim() || imgElement.getAttribute("alt");
					const durationVar = li.querySelector(".duration, var.duration");
					const durationStr = durationVar ? durationVar.textContent.trim() : "0:00";
					const duration = parseDuration(durationStr);
					const viewsSpan = li.querySelector(".views var, .views");
					const viewsStr = viewsSpan ? viewsSpan.textContent.trim() : "0";
					const views = viewsStr && viewsStr.includes("K") || viewsStr.includes("M") ? parseNumberSuffix(viewsStr) : 0;

					const authorLink = li.querySelector(".usernameWrap a, a[href*='/model/'], a[href*='/pornstar/'], a[href*='/channels/']");
					let authorInfo = {
						channel: "",
						authorName: ""
					};
					if (authorLink) {
						authorInfo.channel = URL_BASE + authorLink.getAttribute("href");
						authorInfo.authorName = authorLink.textContent.trim();
					}

					resultArray.push(new PlatformVideo({
						id: new PlatformID(PLATFORM, videoId, config.id),
						name: title ?? "",
						thumbnails: new Thumbnails([new Thumbnail(thumbnailUrl, 0)]),
						author: new PlatformAuthorLink(new PlatformID(PLATFORM, authorInfo.authorName, config.id),
							authorInfo.authorName,
							authorInfo.channel,
							""),
						datetime: undefined,
						duration: duration,
						viewCount: views,
						url: videoUrl.startsWith("http") ? videoUrl : URL_BASE + videoUrl,
						isLive: false
					}));
				}
			}
		}
	});

	log(`Found ${resultArray.length} recommendations`);
	return new ContentPager(resultArray, false);
};

// Get shorts from the /shorties/ page
source.getShorts = function(context) {
	// Parse context
	var from = 1;
	var count = 12;

	if (typeof context === 'string') {
		try {
			const parsed = JSON.parse(context);
			from = parsed.from ?? 1;
			count = parsed.count ?? 12;
		} catch (e) {
			// Use defaults
		}
	} else if (context) {
		from = context.from ?? 1;
		count = context.count ?? 12;
	}

	return getShortsPager(from, count);
};

function getShortsPager(from, count) {
	log(`getShortsPager from=${from} count=${count}`);

	// PornHub's /shorties page returns random shorts on each visit
	// Not paginated - each fetch gets a fresh random set
	const url = URL_BASE + "/shorties";

	var html = httpGET(url, {});

	// Extract JSON_SHORTIES from the JavaScript in the HTML
	// Pattern can be either:
	// 1. JSON_SHORTIES = insertAfterNthPosition([...]);
	// 2. if (SHOW_SHORTIES_ADS) { JSON_SHORTIES = insertAfterNthPosition([...]); }

	// Find the line that assigns JSON_SHORTIES
	var startIdx = html.indexOf('JSON_SHORTIES = insertAfterNthPosition([');
	if (startIdx === -1) {
		log("No JSON_SHORTIES assignment found in page");
		return new PornhubVideoPager([], false, "/shorties", {}, 1);
	}

	// Extract the JSON array - find the matching closing bracket and semicolon
	var arrayStart = html.indexOf('[', startIdx);
	var bracketCount = 0;
	var arrayEnd = -1;
	var inString = false;
	var escapeNext = false;

	for (var i = arrayStart; i < html.length; i++) {
		var char = html[i];

		if (escapeNext) {
			escapeNext = false;
			continue;
		}

		if (char === '\\') {
			escapeNext = true;
			continue;
		}

		if (char === '"' && !escapeNext) {
			inString = !inString;
			continue;
		}

		if (inString) continue;

		if (char === '[') {
			bracketCount++;
		} else if (char === ']') {
			bracketCount--;
			if (bracketCount === 0) {
				arrayEnd = i + 1;
				break;
			}
		}
	}

	if (arrayEnd === -1) {
		log("Could not find end of JSON_SHORTIES array");
		return new PornhubVideoPager([], false, "/shorties", {}, 1);
	}

	var jsonString = html.substring(arrayStart, arrayEnd);
	if (!jsonString) {
		log("No JSON_SHORTIES data extracted");
		return new PornhubVideoPager([], false, "/shorties", {}, 1);
	}

	var shortsData;
	try {
		shortsData = JSON.parse(jsonString);
	} catch (e) {
		log("Failed to parse JSON_SHORTIES: " + e);
		return new PornhubVideoPager([], false, "/shorties", {}, 1);
	}

	if (!shortsData || shortsData.length === 0) {
		log("No shorts data found");
		return new PornhubVideoPager([], false, "/shorties", {}, 1);
	}

	var resultArray = [];

	shortsData.forEach(function (short) {
		if (!short.videoId) return;

		const videoId = short.videoId.toString();
		const title = short.videoTitle || "";
		const thumbnailUrl = short.imageUrl || "";
		const videoUrl = short.linkUrl || "";
		const authorName = short.name || "";
		const authorUrl = short.profileUrl || "";

		// Calculate duration from mediaDefinitions if available
		var duration = 0;
		if (short.trackingTimeWatched && short.trackingTimeWatched.video_duration) {
			duration = short.trackingTimeWatched.video_duration;
		}

		// Parse likes as views (shorties don't have view count)
		var views = 0;
		if (short.likeInfo) {
			const likeStr = short.likeInfo.toString();
			if (likeStr.includes("K") || likeStr.includes("M")) {
				views = parseNumberSuffix(likeStr);
			} else {
				views = parseInt(likeStr) || 0;
			}
		}

		// Extract video sources from mediaDefinitions
		var sources = [];
		if (short.mediaDefinitions && Array.isArray(short.mediaDefinitions)) {
			short.mediaDefinitions.forEach(function (mediaDefinition) {
				if (mediaDefinition.format === "hls" && mediaDefinition.videoUrl) {
					var quality = mediaDefinition.quality;
					var resolution = supportedResolutions[quality];
					if (resolution) {
						sources.push(new HLSSource({
							name: quality + "p",
							width: resolution.width,
							height: resolution.height,
							url: mediaDefinition.videoUrl,
							duration: duration,
							priority: mediaDefinition.defaultQuality === true
						}));
					}
				}
			});
		}

		// If we have sources, return PlatformVideoDetails (playable)
		// If no sources, return PlatformVideo (metadata only)
		if (sources.length > 0) {
			resultArray.push(new PlatformVideoDetails({
				id: new PlatformID(PLATFORM, videoId, config.id),
				name: title ?? "",
				thumbnails: new Thumbnails([new Thumbnail(thumbnailUrl, 0)]),
				author: new PlatformAuthorLink(new PlatformID(PLATFORM, authorName, config.id),
					authorName,
					authorUrl,
					""),
				datetime: undefined,
				duration: duration,
				viewCount: views,
				url: videoUrl.startsWith("http") ? videoUrl : URL_BASE + videoUrl,
				isLive: false,
				isShort: true,
				description: "",
				video: new VideoSourceDescriptor(sources),
				rating: new RatingLikes(parseInt(short.likeNumber) || 0)
			}));
		} else {
			// No sources available, return metadata only
			resultArray.push(new PlatformVideo({
				id: new PlatformID(PLATFORM, videoId, config.id),
				name: title ?? "",
				thumbnails: new Thumbnails([new Thumbnail(thumbnailUrl, 0)]),
				author: new PlatformAuthorLink(new PlatformID(PLATFORM, authorName, config.id),
					authorName,
					authorUrl,
					""),
				datetime: undefined,
				duration: duration,
				viewCount: views,
				url: videoUrl.startsWith("http") ? videoUrl : URL_BASE + videoUrl,
				isLive: false,
				isShort: true
			}));
		}
	});

	log(`Found ${resultArray.length} shorts`);

	// Always hasMore=true since each fetch returns new random shorts
	var hasMore = resultArray.length > 0;

	return new PornhubVideoPager(resultArray, hasMore, "/shorties", {}, 1);
}



/**
 * Detect if the HTML response is a bot detection challenge page
 * @param {string} html - The HTML response body
 * @returns {boolean} - True if it's a challenge page
 */
function isBotChallenge(html) {
	return html.includes("function leastFactor(n)") && html.includes("document.cookie=\"KEY=");
}

/**
 * Solve PornHub's bot detection challenge using eval()
 * @param {string} html - The challenge page HTML
 * @returns {string|null} - The KEY cookie value, or null if solving failed
 */
function solveBotChallenge(html) {
	try {
		log("Solving bot detection challenge...");

		// Extract the JavaScript challenge code
		var scriptStart = html.indexOf("<script type=\"text/javascript\">");
		var scriptEnd = html.indexOf("</script>", scriptStart);
		if (scriptStart === -1 || scriptEnd === -1) {
			log("Could not find script tags in challenge");
			return null;
		}

		var scriptContent = html.substring(scriptStart + 31, scriptEnd);

		// Remove HTML comments (<!-- and -->)
		scriptContent = scriptContent.replace(/<!--/g, "").replace(/-->/g, "");

		// Replace document.cookie assignment with a return statement
		// Original: document.cookie="KEY="+n+"*"+p/n+":"+s+":2234595840:1;path=/;";
		// We want to capture: n+"*"+p/n+":"+s+":2234595840:1"
		scriptContent = scriptContent.replace(
			/document\.cookie\s*=\s*"KEY="\s*\+\s*([^;]+);/,
			'return $1;'
		);

		// Remove document.location.reload
		scriptContent = scriptContent.replace(/document\.location\.reload\([^)]*\);?/g, "");

		// Wrap in a function that calls go() and returns the result
		var solverCode = scriptContent + "\nreturn go();";

		log("Executing challenge code...");

		// Execute the challenge using eval
		var keyCookieValue = eval("(function() { " + solverCode + " })()");

		if (keyCookieValue) {
			log("Challenge solved: KEY=" + keyCookieValue.substring(0, 20) + "...");
			return keyCookieValue;
		} else {
			log("Challenge execution returned no value");
			return null;
		}
	} catch (e) {
		log("Failed to solve bot challenge: " + e);
		return null;
	}
}

// the only things you need for a valid session are as follows:
// 1.) token
// 2.) cookies: __l, __s, and ss
// this will allow you to get search suggestions!!
function refreshSession() {
	const resp = http.GET(URL_BASE, headers);
	if (!resp.isOk)
		throw new ScriptException("Failed request [" + URL_BASE + "] (" + resp.code + ")");
	else {
		var dom = domParser.parseFromString(resp.body);

		// Extract token from search input
		const searchInput = dom.querySelector("#searchInput");
		if (searchInput) {
			state.token = searchInput.getAttribute("data-token");
			log("Token extracted: " + (state.token ? state.token.substring(0, 20) + "..." : "null"));
		} else {
			log("Warning: #searchInput not found, token extraction failed");
		}

		// Extract session ID from meta tag
		var sessionId = "";
		const metaTag = dom.querySelector("meta[name=\"adsbytrafficjunkycontext\"]");
		if (metaTag) {
			const adContextInfo = metaTag.getAttribute("data-info");
			sessionId = JSON.parse(adContextInfo)["session_id"];
			state.sessionCookie = sessionId;
			log("Session ID extracted: ss=" + sessionId.substring(0, 10) + "...");
		} else {
			log("Warning: meta tag not found, session ID extraction failed");
		}

		// Extract cookies from response headers
		// The __l and __s cookies are essential for autocomplete to work
		var cookiesFromHeaders = [];
		log("Response headers available: " + (resp.headers ? "yes" : "no"));
		if (resp.headers) {
			log("Headers keys: " + Object.keys(resp.headers).join(", "));
			if (resp.headers["set-cookie"]) {
				var setCookieHeaders = resp.headers["set-cookie"];
				log("set-cookie header found, type: " + typeof setCookieHeaders);
				if (typeof setCookieHeaders === 'string') {
					setCookieHeaders = [setCookieHeaders];
				}

				for (var i = 0; i < setCookieHeaders.length; i++) {
					var cookieHeader = setCookieHeaders[i];
					// Extract cookie name and value (format: "name=value; path=/; ...")
					var cookieParts = cookieHeader.split(';')[0].trim();
					cookiesFromHeaders.push(cookieParts);
					log("Extracted cookie: " + cookieParts);
				}
			} else {
				log("No set-cookie header found");
			}
		}

		// Build the complete cookie string
		// Start with required cookies
		var cookieString = "platform=pc; accessAgeDisclaimerPH=2";

		// Add cookies from response headers (__l, __s, etc.)
		for (var i = 0; i < cookiesFromHeaders.length; i++) {
			cookieString += "; " + cookiesFromHeaders[i];
		}

		// Add session ID if we got one from meta tag
		if (sessionId) {
			cookieString += "; ss=" + sessionId;
		}

		headers["Cookie"] = cookieString;
		log("Session refreshed - token: " + (state.token ? "present" : "empty") + ", cookies set: " + cookiesFromHeaders.length);
	}
}

function getVideoId(dom) {
	var videoId =  dom.querySelector("div#player").getAttribute("data-video-id");
	return videoId
}

source.getComments = function (url) {
	var html = httpGET(url, {});
	var dom = domParser.parseFromString(html);
	var videoId = getVideoId(dom);

	return getCommentPager(`/comment/show?id=${videoId}&popular=0&what=video&token=${state.token}`, {}, 1);
}

source.getSubComments = function (comment) {
	throw new ScriptException("This is a sample");
}

function parseStringWithKorMSuffixes(subscriberString) {
    const numericPart = parseFloat(subscriberString);

    if (subscriberString.includes("K")) {
        return Math.floor(numericPart * 1000);
    } else if (subscriberString.includes("M")) {
        return Math.floor(numericPart * 1000000);
    } else {
        return Math.floor(numericPart);
    }
}




function getCommentPager(path, params, page) {
	log(`getCommentPager page=${page}`, params)

	const count = 10;
	const page_end = (page ?? 1) * count;
	params = { ... params, page }

	const url = URL_BASE + path;
	const urlWithParams = `${url}${buildQuery(params)}`;

	// Comment API requires a valid token in the URL path
	var html = httpGET(urlWithParams, { requireToken: true });

	var comments = getComments(html);
	// if no comments, return empty page
	if (comments.total === 0) return new PornhubCommentPager();
	
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
	}), comments.total > page_end, path, params, page);
}




function getComments(html) {

	var dom = domParser.parseFromString(html);

	var comments = []

	const total = parseInt(dom.querySelector("div#cmtWrapper div.cmtHeader h2 span").textContent.trim().replace("(", "").replace(")", ""));
	if (total > 0) {
		// Loop through each comment block
		// todo nested blocks
		dom.querySelectorAll('div#cmtContent div.commentBlock').forEach(commentBlock => {
			const id = commentBlock.getAttribute("class").match(/commentTag(\d+)/)[1];

			const avatar = commentBlock.querySelector("img").getAttribute("src");
			const username = commentBlock.querySelector('.usernameLink').textContent.trim();
			const date = parseRelativeDate(commentBlock.querySelector('div.date').textContent.trim());
			const message = commentBlock.querySelector('.commentMessage span').textContent.trim();
			const voteUp = parseInt(commentBlock.querySelector('span.voteTotal').textContent.trim());
			var isVoteDownPresent = commentBlock.querySelectorAll('div.actionButtonsBlock span') !== null;

			var voteDown = 0;
			if (isVoteDownPresent) {
				voteDown = parseInt(commentBlock.querySelectorAll('div.actionButtonsBlock span')[1].textContent.trim());
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


/**
 * Normalize PornHub URL by removing country-specific subdomains
 * @param {string} url - The URL to normalize
 * @returns {string} - Normalized URL with www.pornhub.com
 */
function normalizePornhubUrl(url) {
	if (!url) return url;

	// Replace any country-specific subdomain (rt.pornhub.com, de.pornhub.com, etc.) with www.pornhub.com
	// Also handles urls without subdomain (pornhub.com -> www.pornhub.com)
	return url.replace(/https?:\/\/([a-z]{2}\.)?pornhub\.com/, "https://www.pornhub.com");
}

/**
 * Extract platform name from URL
 * @param {string} url - The URL to extract platform from
 * @param {string} label - Optional label from the page
 * @returns {string} - Platform name or "Website"
 */
function extractPlatformName(url, label) {
	try {
		// If label is provided and meaningful, use it
		if (label && label !== "") {
			return label;
		}

		// Extract domain from URL
		var domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();

		// Map of domain patterns to friendly names
		var platformMap = {
			'twitter.com': 'Twitter',
			'x.com': 'Twitter',
			'instagram.com': 'Instagram',
			'tiktok.com': 'TikTok',
			'youtube.com': 'YouTube'
		};

		// Check if domain matches any known platform
		for (var pattern in platformMap) {
			if (domain.includes(pattern)) {
				return platformMap[pattern];
			}
		}

		// For unknown domains, capitalize the first part of the domain
		var domainParts = domain.split('.');
		if (domainParts.length > 0) {
			var name = domainParts[0];
			return name.charAt(0).toUpperCase() + name.slice(1);
		}

		return "Website";
	} catch (e) {
		return "Website";
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


function getChannelInfo(url) {
	var html = httpGET(url, {});
	let dom = domParser.parseFromString(html);

	const avatarElement = dom.getElementById("getAvatar");
	var channelThumbnail = avatarElement ? avatarElement.getAttribute("src") : "";

	const bannerElement = dom.getElementById("coverPictureDefault");
	var channelBanner = bannerElement ? bannerElement.getAttribute("src") : "";

	const nameElement = dom.querySelector("h1");
	var channelName = nameElement ? nameElement.textContent.trim() : "";

	var statsNode = dom.getElementById("stats");

	var channelSubscribers = (statsNode && statsNode.childNodes[1]) ? parseInt(statsNode.childNodes[1].textContent.trim().replace(/,/g, '')) : 0;
	var channelViews = (statsNode && statsNode.childNodes[0]) ? parseInt(statsNode.childNodes[0].textContent.trim().replace(/,/g, '')) : 0;
	var channelVideos = (statsNode && statsNode.childNodes[2]) ? parseInt(statsNode.childNodes[2].textContent.trim().split(" ")[0].replace(/,/g, '')) : 0;

	const descElement = dom.querySelector(".cdescriptions");
	var channelDescription = (descElement && descElement.childNodes[0]) ? descElement.childNodes[0].textContent.trim() : "";

	// Add channel stats to description
	if (channelViews > 0 || channelVideos > 0 || channelSubscribers > 0) {
		channelDescription += "\n\n📊 Channel Stats:";
		if (channelVideos > 0) {
			channelDescription += "\n• Total Videos: " + channelVideos.toLocaleString();
		}
		if (channelViews > 0) {
			channelDescription += "\n• Total Views: " + channelViews.toLocaleString();
		}
		if (channelSubscribers > 0) {
			channelDescription += "\n• Subscribers: " + channelSubscribers.toLocaleString();
		}
	}

	// Extract social media links
	var channelLinks = {};
	var socialLinksSection = dom.querySelector(".socialLinksSection, section.socialLinksSection");
	if (socialLinksSection) {
		var socialLinks = socialLinksSection.querySelectorAll("ul.socialList li a");
		socialLinks.forEach(function(link) {
			var href = link.getAttribute("href");
			if (href && !href.includes("pornhub.com")) {
				var linkText = link.querySelector(".socialText");
				var label = linkText ? linkText.textContent.trim() : "";

				// Extract platform name from URL domain
				var platformName = extractPlatformName(href, label);

				// Use the label if available, otherwise use the extracted platform name
				var linkLabel = label || platformName;

				if (linkLabel) {
					channelLinks[linkLabel] = href;
				}
			}
		});
	}

	return {
		channelName: channelName,
		channelThumbnail: channelThumbnail,
		channelBanner: channelBanner,
		channelSubscribers: channelSubscribers,
		channelDescription: channelDescription,
		channelUrl: normalizePornhubUrl(url),
		channelLinks: channelLinks
	}
}



function getPornstarInfo(url) {
	var html = httpGET(url, {});
	let dom = domParser.parseFromString(html);

	const avatarElement = dom.getElementById("getAvatar");
	const channelThumbnail = avatarElement ? avatarElement.getAttribute("src") : "";

	const bannerElement = dom.getElementById("coverPictureDefault");
	const channelBanner = bannerElement ? bannerElement.getAttribute("src") : "";

	const nameElement = dom.querySelector("div.name > h1");
	const channelName = nameElement ? nameElement.textContent.trim() : "";

	var channelDescription;
	const channelDescriptionElement = dom.querySelector("section.aboutMeSection > div:not([class])")
	if(!channelDescriptionElement) {
		channelDescription = "";
	} else {
		channelDescription = channelDescriptionElement.textContent;
	}

	const statsNode = dom.querySelector("div.infoBoxes");
	const channelSubscribers = statsNode ? parseNumberSuffix(statsNode.querySelector("div[data-title^=Subscribers] > span.big").textContent.trim()) : 0;
	const channelViews = statsNode ? parseNumberSuffix(statsNode.querySelector("div[data-title^=Video] > span.big").textContent.trim()) : 0;

	// Try to get video count from the stats node
	var channelVideos = 0;
	const videoCountElement = dom.querySelector("div.pornstarVideosCounter span.big, div.videosCounter span");
	if (videoCountElement) {
		const videoCountText = videoCountElement.textContent.trim();
		channelVideos = videoCountText.includes("K") || videoCountText.includes("M") ? parseNumberSuffix(videoCountText) : parseInt(videoCountText.replace(/,/g, '')) || 0;
	}

	// Add channel stats to description
	if (channelViews > 0 || channelVideos > 0 || channelSubscribers > 0) {
		channelDescription += "\n\n📊 Channel Stats:";
		if (channelVideos > 0) {
			channelDescription += "\n• Total Videos: " + channelVideos.toLocaleString();
		}
		if (channelViews > 0) {
			channelDescription += "\n• Total Views: " + channelViews.toLocaleString();
		}
		if (channelSubscribers > 0) {
			channelDescription += "\n• Subscribers: " + channelSubscribers.toLocaleString();
		}
	}

	// Extract social media links
	var channelLinks = {};
	var socialLinksSection = dom.querySelector(".socialLinksSection, section.socialLinksSection");
	if (socialLinksSection) {
		var socialLinks = socialLinksSection.querySelectorAll("ul.socialList li a");
		socialLinks.forEach(function(link) {
			var href = link.getAttribute("href");
			if (href && !href.includes("pornhub.com")) {
				var linkText = link.querySelector(".socialText");
				var label = linkText ? linkText.textContent.trim() : "";

				// Extract platform name from URL domain
				var platformName = extractPlatformName(href, label);

				// Use the label if available, otherwise use the extracted platform name
				var linkLabel = label || platformName;

				if (linkLabel) {
					channelLinks[linkLabel] = href;
				}
			}
		});
	}

	return {
		channelName: channelName,
		channelThumbnail: channelThumbnail,
		channelBanner: channelBanner,
		channelSubscribers: channelSubscribers,
		channelDescription: channelDescription,
		channelUrl: normalizePornhubUrl(url),
		channelLinks: channelLinks
	}
}




class PornhubVideoPager extends VideoPager {
	constructor(results, hasMore, path, params, page) {
		super(results, hasMore, { path, params,  page});
	}

	nextPage() {
		// For shorts, call getShortsPager to get fresh random shorts
		if (this.context.path === "/shorties") {
			return getShortsPager(0, 12);
		}
		return getVideoPager(this.context.path, this.context.params, (this.context.page ?? 1) + 1);
	}
}


class PornhubChannelVideosPager extends VideoPager {
	constructor(results, hasMore, path, params, page) {
		super(results, hasMore, { path, params,  page});
	}

	nextPage() {
		if(this.context.path.includes("/channels/")) {
			return getChannelVideosPager(this.context.path, this.context.params, (this.context.page ?? 1) + 1);
		} else if(this.context.path.includes("/model/")) {
			return getModelVideosPager(this.context.path, this.context.params, (this.context.page ?? 1) + 1);
		}
		else {
			return getPornstarVideosPager(this.context.path, this.context.params, (this.context.page ?? 1) + 1);
		}
	}
}



class PornhubChannelPager extends ChannelPager {
	constructor(results, hasMore, path, params, page) {
		super(results, hasMore, { path, params, page });
	}
	
	nextPage() {
		return getChannelPager(this.context.path, this.context.params, (this.context.page ?? 1) + 1);
	}
}


class PornhubCommentPager extends CommentPager {
	constructor(results, hasMore, path, params, page) {
		super(results, hasMore, { path, params, page });
	}

	nextPage() {
		return getCommentPager(this.context.path, this.context.params, (this.context.page ?? 1) + 1);
	}
}

// Multi-channel pager for combined pornstars/models/channels search
class PornhubMultiChannelPager extends ChannelPager {
	constructor(results, hasMore, query, page) {
		super(results, hasMore, { query, page });
	}

	nextPage() {
		return getMultiChannelPager(this.context.query, (this.context.page ?? 1) + 1);
	}
}

// Use autocomplete API for channel search (no bot detection, no pagination issues!)
function getAutocompleteChannelPager(query) {
	try {
		// Build autocomplete API URL
		var apiUrl = URL_BASE + "/api/v1/video/search_autocomplete?pornstars=true&token=" + state.token + "&orientation=straight&q=" + encodeURIComponent(query) + "&alt=0";
		log("Fetching channel search from autocomplete: " + apiUrl);

		// Use httpGET with options object
		var json = httpGET(apiUrl, {
			headers: {
				"Cookie": headers["Cookie"],
				"User-Agent": headers["User-Agent"],
				"Accept": "*/*",
				"Accept-Language": "en-US,en;q=0.5",
				"Referer": URL_BASE + "/",
				"X-Requested-With": "XMLHttpRequest",
				"Content-Type": "application/x-www-form-urlencoded"
			},
			requireToken: true,
			parseJson: true,
			retries: 3
		});

		var allChannels = [];

		// Add models
		if (json.models && Array.isArray(json.models)) {
			json.models.forEach(function(model) {
				allChannels.push(new PlatformAuthorLink(
					new PlatformID(PLATFORM, model.slug, config.id),
					model.name,
					URL_BASE + "/model/" + model.slug,
					"", // No avatar in autocomplete API
					0   // No subscribers in autocomplete API
				));
			});
			log(`Found ${json.models.length} models`);
		}

		// Add pornstars
		if (json.pornstars && Array.isArray(json.pornstars)) {
			json.pornstars.forEach(function(pornstar) {
				allChannels.push(new PlatformAuthorLink(
					new PlatformID(PLATFORM, pornstar.slug, config.id),
					pornstar.name,
					URL_BASE + "/pornstar/" + pornstar.slug,
					"", // No avatar in autocomplete API
					0   // No subscribers in autocomplete API
				));
			});
			log(`Found ${json.pornstars.length} pornstars`);
		}

		// Add channels
		if (json.channels && Array.isArray(json.channels)) {
			json.channels.forEach(function(channel) {
				allChannels.push(new PlatformAuthorLink(
					new PlatformID(PLATFORM, channel.slug, config.id),
					channel.name,
					URL_BASE + "/channels/" + channel.slug,
					"", // No avatar in autocomplete API
					0   // No subscribers in autocomplete API
				));
			});
			log(`Found ${json.channels.length} channels`);
		}

		log(`Found ${allChannels.length} total creators from autocomplete`);

		// Autocomplete doesn't support pagination, so hasMore is always false
		return new PornhubMultiChannelPager(allChannels, false, query, 1);
	} catch(e) {
		log("Channel search failed: " + e);
		return new PornhubMultiChannelPager([], false, query, 1);
	}
}

// Search both pornstars and channels (OLD METHOD - using HTML scraping with bot detection)
function getMultiChannelPager(query, page) {
	log(`getMultiChannelPager query=${query} page=${page}`);

	var allChannels = [];
	var hasMore = false;

	// Search pornstars
	try {
		var pornstarHtml = httpGET(URL_BASE + "/pornstars/search?search=" + encodeURIComponent(query) + "&page=" + page, {});
		var pornstars = getPornstarsFromSearch(pornstarHtml);
		allChannels = allChannels.concat(pornstars.channels);
		hasMore = hasMore || pornstars.hasNextPage;
		log(`Found ${pornstars.channels.length} pornstars`);
	} catch(e) {
		log("Failed to search pornstars: " + e);
	}

	// Search channels
	try {
		var channelHtml = httpGET(URL_BASE + "/channels/search?channelSearch=" + encodeURIComponent(query) + "&page=" + page, {});
		var channels = getChannels(channelHtml);
		allChannels = allChannels.concat(channels.channels);
		hasMore = hasMore || channels.hasNextPage;
		log(`Found ${channels.channels.length} channels`);
	} catch(e) {
		log("Failed to search channels: " + e);
	}

	log(`Found ${allChannels.length} total creators`);

	return new PornhubMultiChannelPager(allChannels.map(c => {
		return new PlatformAuthorLink(new PlatformID(PLATFORM, c.name, config.id),
			c.displayName,
			URL_BASE + c.url,
			c.avatar ?? "",
			c.subscribers);
	}), hasMore, query, page);
}

// Parse pornstars from search results
function getPornstarsFromSearch(html) {
	var dom = domParser.parseFromString(html);
	var resultArray = [];

	// Try multiple possible selectors for pornstar search results
	var pornstarElements = dom.querySelectorAll("div.pornstarsSearchResult li, ul.pornstars-list li, li.pornstar-item, div.performerCard");

	if (pornstarElements.length === 0) {
		log("No pornstar elements found with standard selectors");
		return { hasNextPage: false, channels: [] };
	}

	pornstarElements.forEach(function(li) {
		var linkElement = li.querySelector("a");
		if (!linkElement) return;

		var url = linkElement.getAttribute("href");
		if (!url || !url.includes("/pornstar/")) return;

		var imgElement = li.querySelector("img");
		var avatar = imgElement ? (imgElement.getAttribute("data-src") || imgElement.getAttribute("src") || "") : "";

		// Try different selectors for name
		var nameElement = li.querySelector(".pornStarName, .performerCardName, .title");
		var displayName = nameElement ? nameElement.textContent.trim() : "";
		if (!displayName && linkElement.getAttribute("title")) {
			displayName = linkElement.getAttribute("title");
		}

		// Try different selectors for subscriber count
		var rankElement = li.querySelector(".rank_number, .subscribers, .subscribersText");
		var subscribers = 0;
		if (rankElement) {
			var subsText = rankElement.textContent.trim();
			subscribers = subsText.includes("K") || subsText.includes("M") ? parseNumberSuffix(subsText) : parseInt(subsText) || 0;
		}

		var name = url ? url.split("/").filter(s => s).pop() : displayName;

		if (url && displayName) {
			resultArray.push({
				subscribers: subscribers,
				name: name,
				url: url,
				displayName: displayName,
				avatar: avatar
			});
		}
	});

	var hasNextPage = false;
	var pageNextNode = dom.querySelector("li.page_next a, a.page-next, .pagination a.next");
	if (pageNextNode && pageNextNode.getAttribute("href") && pageNextNode.getAttribute("href") !== "") {
		hasNextPage = true;
	}

	log(`getPornstarsFromSearch: Found ${resultArray.length} pornstars`);

	return {
		hasNextPage: hasNextPage,
		channels: resultArray
	};
}


function getChannelPager(path, params, page) {

	log(`getChannelPager page=${page}`, params)

	const count = 40;
	const page_end = (page ?? 1) * count;
	params = { ... params, page }

	const url = URL_BASE + path;
	const urlWithParams = `${url}${buildQuery(params)}`;

	var html = httpGET(urlWithParams, {});

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
			var displayName = li.querySelector("div.descriptionContainer li a.usernameLink").textContent.trim()
			var url = li.querySelector("div.descriptionContainer li a.usernameLink").getAttribute("href");
			var subscribers = parseInt(li.querySelector("div.descriptionContainer li span").textContent.trim().replace(/\,/, ""));
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

// todo: maybe improve?
function getChannelVideosPager(path, params, page) {
	log(`getChannelVideosPager page=${page}`, params)

	const count = 36;
	const page_end = (page ?? 1) * count;
	params = { ... params, page }

	const url = path;
	const urlWithParams = `${url}${buildQuery(params)}`;

	var html = httpGET(urlWithParams, {});

	// Use getVideos() with class selector since channel pages use the same structure as regular video pages
	var dom = domParser.parseFromString(html);

	// Try specific IDs first (these are guaranteed to have videos)
	var ulElement = dom.getElementById("mostRecentVideosSection") || dom.getElementById("moreData");

	// If no ID found, try querySelectorAll and find first non-empty ul
	if (!ulElement) {
		var ulElements = dom.querySelectorAll("ul.full-row-thumbs.videos, ul.videos.full-row-thumbs");
		for (var i = 0; i < ulElements.length; i++) {
			var testUl = ulElements[i];
			if (testUl.querySelectorAll("li.pcVideoListItem").length > 0) {
				ulElement = testUl;
				break;
			}
		}
	}

	if (!ulElement) {
		log("Warning: Could not find ul.full-row-thumbs.videos, trying old getChannelContents method");
		var vids = getChannelContents(html);
		return _buildPornhubChannelVideosPager(vids, vids.totalElemsPages > page_end, path, params, page);
	}

	// Parse videos using the same logic as getVideos but adapted for channel pages
	var resultArray = [];
	var authorName = path.split("/")[4]; // Extract channel name from path
	var authorInfo = {
		authorName: authorName,
		avatar: ""
	};

	ulElement.querySelectorAll("li.pcVideoListItem").forEach(function (li) {
		const videoId = li.getAttribute("data-video-id");
		if (videoId && !isNaN(videoId)) {
			const aElement = li.querySelector('a.js-linkVideoThumb');
			if (aElement) {
				const videoUrl = aElement.getAttribute('href');
				const imgElement = aElement.querySelector('img.js-videoThumb');
				if (imgElement && videoUrl) {
					const thumbnailUrl = imgElement.getAttribute('src');
					const title = imgElement.getAttribute("alt") || imgElement.getAttribute("data-title") || aElement.getAttribute("data-title");
					const durationVar = aElement.querySelector(".duration");
					const durationStr = durationVar ? durationVar.textContent.trim() : "0:00";
					const duration = parseDuration(durationStr);
					const viewsSpan = li.querySelector(".views var");
					const viewsStr = viewsSpan ? viewsSpan.textContent.trim() : "0";
					const views = parseNumberSuffix(viewsStr);

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

	var vids = {
		videos: resultArray,
		totalElemsPages: resultArray.length
	};
	return _buildPornhubChannelVideosPager(vids, resultArray.length >= count, path, params, page);
}

function getModelVideosPager(path, params, page) {
	log(`getModelVideosPager page=${page}`, params)
	params = { ... params, page }

	const url = path;
	const urlWithParams = `${url}${buildQuery(params)}`;

	var html = httpGET(urlWithParams, {});

	// Try new structure first (same as regular video pages)
	var dom = domParser.parseFromString(html);

	// Try specific IDs first (these are guaranteed to have videos)
	var ulElement = dom.getElementById("mostRecentVideosSection") || dom.getElementById("moreData");

	// If no ID found, try querySelectorAll and find first non-empty ul
	if (!ulElement) {
		var ulElements = dom.querySelectorAll("ul.full-row-thumbs.videos, ul.videos.full-row-thumbs");
		for (var i = 0; i < ulElements.length; i++) {
			var testUl = ulElements[i];
			if (testUl.querySelectorAll("li.pcVideoListItem").length > 0) {
				ulElement = testUl;
				break;
			}
		}
	}

	if (ulElement) {
		log("Using new ul.full-row-thumbs.videos structure for model page");
		var resultArray = [];
		var authorName = path.split("/")[4]; // Extract model name from path
		var authorInfo = {
			authorName: authorName,
			avatar: ""
		};

		const count = 40;
		ulElement.querySelectorAll("li.pcVideoListItem").forEach(function (li) {
			const videoId = li.getAttribute("data-video-id");
			if (videoId && !isNaN(videoId)) {
				const aElement = li.querySelector('a.js-linkVideoThumb');
				if (aElement) {
					const videoUrl = aElement.getAttribute('href');
					const imgElement = aElement.querySelector('img.js-videoThumb');
					if (imgElement && videoUrl) {
						const thumbnailUrl = imgElement.getAttribute('src');
						const title = imgElement.getAttribute("alt") || imgElement.getAttribute("data-title") || aElement.getAttribute("data-title");
						const durationVar = aElement.querySelector(".duration");
						const durationStr = durationVar ? durationVar.textContent.trim() : "0:00";
						const duration = parseDuration(durationStr);
						const viewsSpan = li.querySelector(".views var");
						const viewsStr = viewsSpan ? viewsSpan.textContent.trim() : "0";
						const views = parseNumberSuffix(viewsStr);

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

		var vids = {
			videos: resultArray,
			hasNextPage: resultArray.length >= count
		};
		return _buildPornhubChannelVideosPager(vids, vids.hasNextPage, path, params, page);
	}

	// Fallback to old structure
	log("Using old getModelContents structure for model page");
	var vids = getModelContents(html);
	return _buildPornhubChannelVideosPager(vids, vids.hasNextPage, path, params, page)
}

function getPornstarVideosPager(path, params, page) {
	log(`getPornstarVideosPager page=${page}`, params)

	const count = 40;
	const page_end = (page ?? 1) * count;
	params = { ... params, page }

	const url = path;
	const urlWithParams = `${url}${buildQuery(params)}`;

	var html = httpGET(urlWithParams, {});

	// Try new structure first (same as regular video pages)
	var dom = domParser.parseFromString(html);

	// Try specific IDs first (these are guaranteed to have videos)
	var ulElement = dom.getElementById("mostRecentVideosSection") || dom.getElementById("moreData");

	// If no ID found, try querySelectorAll and find first non-empty ul
	if (!ulElement) {
		var ulElements = dom.querySelectorAll("ul.full-row-thumbs.videos, ul.videos.full-row-thumbs");
		for (var i = 0; i < ulElements.length; i++) {
			var testUl = ulElements[i];
			if (testUl.querySelectorAll("li.pcVideoListItem").length > 0) {
				ulElement = testUl;
				break;
			}
		}
	}

	if (ulElement) {
		log("Using new ul.full-row-thumbs.videos structure for pornstar page");
		var resultArray = [];
		var authorName = path.split("/")[4]; // Extract pornstar name from path
		var authorInfo = {
			authorName: authorName,
			avatar: ""
		};

		ulElement.querySelectorAll("li.pcVideoListItem").forEach(function (li) {
			const videoId = li.getAttribute("data-video-id");
			if (videoId && !isNaN(videoId)) {
				const aElement = li.querySelector('a.js-linkVideoThumb');
				if (aElement) {
					const videoUrl = aElement.getAttribute('href');
					const imgElement = aElement.querySelector('img.js-videoThumb');
					if (imgElement && videoUrl) {
						const thumbnailUrl = imgElement.getAttribute('src');
						const title = imgElement.getAttribute("alt") || imgElement.getAttribute("data-title") || aElement.getAttribute("data-title");
						const durationVar = aElement.querySelector(".duration");
						const durationStr = durationVar ? durationVar.textContent.trim() : "0:00";
						const duration = parseDuration(durationStr);
						const viewsSpan = li.querySelector(".views var");
						const viewsStr = viewsSpan ? viewsSpan.textContent.trim() : "0";
						const views = parseNumberSuffix(viewsStr);

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

		var vids = {
			videos: resultArray,
			totalElemsPages: resultArray.length
		};
		return _buildPornhubChannelVideosPager(vids, resultArray.length >= count, path, params, page);
	}

	// Fallback to old structure
	log("Using old getPornstarContents structure for pornstar page");
	var vids = getPornstarContents(html);
	return _buildPornhubChannelVideosPager(vids, vids.totalElemsPages > page_end, path, params, page)
}

function _buildPornhubChannelVideosPager(vids, hasNextPage, path, params, page) {
	// Extract the channel URL from the path (remove /videos or /videos/upload suffix)
	var channelUrl = path.replace(/\/videos.*$/, '');

	return new PornhubChannelVideosPager(vids.videos.map(v => {
		return new PlatformVideo({
			id: new PlatformID(PLATFORM, v.id, config.id),
			name: v.title ?? "",
			thumbnails: new Thumbnails([new Thumbnail(v.thumbnailUrl, 0)]),
			author: new PlatformAuthorLink(new PlatformID(PLATFORM, v.authorInfo.authorName, config.id),
				v.authorInfo.authorName,
				channelUrl,
				v.authorInfo.avatar),
			datetime: undefined,
			duration: v.duration,
			viewCount: v.views,
			url: URL_BASE + v.videoUrl,
			isLive: false
		});

	}), hasNextPage, path, params, page);
}


function getChannelContents(html) {
	var dom = domParser.parseFromString(html);

	var statsNodes = dom.querySelectorAll("div#stats div.info.floatRight");

	var total = (statsNodes && statsNodes[2]) ? parseInt(statsNodes[2].textContent.split(" VIDEOS")[0]) : 0;

	var resultArray = []

	const nameElement = dom.querySelector("div.title h1");
	const avatarElement = dom.querySelector("img#getAvatar");

	var authorInfo = {
		authorName: nameElement ? nameElement.textContent.trim() : "",
		avatar: avatarElement ? avatarElement.getAttribute("href") : ""
	}

	const videosContainer = dom.getElementById("showAllChanelVideos");
	if (!videosContainer) return { totalElemsPages: total, videos: resultArray };

	videosContainer.childNodes.forEach((li) => {
		if (!li) return;

		const titleElement = li.querySelector("span.title a");
		if (!titleElement) return;

		var title = titleElement.textContent.trim();
		var videoUrl = titleElement.getAttribute("href");
		if (!videoUrl) return;

		const imgElement = li.querySelector("img");
		var thumbnailUrl = imgElement ? imgElement.getAttribute("src") : "";

		var videoId = li.getAttribute("data-video-id");
		if (!videoId) return;

		const durationElement = li.querySelector("var.duration");
		var duration = durationElement ? parseDuration(durationElement.textContent.trim()) : 0;

		const viewsElement = li.querySelector("div.videoDetailsBlock span.views var");
		var views = viewsElement ? parseStringWithKorMSuffixes(viewsElement.textContent.trim()) : 0;

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

function getPornstarContents(html) {
	var dom = domParser.parseFromString(html);

	// "Showing 1-40 of 52"
	const showingInfoElement = dom.querySelector("div.showingInfo");
	var total = 0;
	if (showingInfoElement) {
		var showingInfo = showingInfoElement.textContent.trim();
		if (showingInfo.length > 0 && showingInfo.includes(" of ")) {
			// "52"
			total = parseInt(showingInfo.split(" of ").slice(-1), 10);
		}
	}

	var resultArray = []

	const nameElement = dom.querySelector("h1[itemprop=name]");
	const avatarElement = dom.querySelector("img#getAvatar");

	var authorInfo = {
		authorName: nameElement ? nameElement.textContent.trim() : "",
		avatar: avatarElement ? avatarElement.getAttribute("src") : ""
	}

	const videoListContainer = dom.querySelector("div.videoUList > ul");
	if (!videoListContainer) return { totalElemsPages: total, videos: resultArray };

	videoListContainer.childNodes.forEach((li) => {
		if (!li) return;

		const titleElement = li.querySelector("span.title a");
		if (!titleElement) return;

		var title = titleElement.textContent.trim();
		var videoUrl = titleElement.getAttribute("href");
		if (!videoUrl) return;

		const imgElement = li.querySelector("img");
		var thumbnailUrl = imgElement ? imgElement.getAttribute("src") : "";

		var videoId = li.getAttribute("data-video-id");
		if (!videoId) return;

		const durationElement = li.querySelector("var.duration");
		var duration = durationElement ? parseDuration(durationElement.textContent.trim()) : 0;

		const viewsElement = li.querySelector("div.videoDetailsBlock span.views var");
		var views = viewsElement ? parseStringWithKorMSuffixes(viewsElement.textContent.trim()) : 0;

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

function getModelContents(html) {
	var dom = domParser.parseFromString(html);
	var hasNextPage;

	const pageNext = dom.querySelector("li.page_next > a");
	if (pageNext) {
		hasNextPage = pageNext.getAttribute("href") !== "";
	} else {
		hasNextPage = false;
	}

	var resultArray = []

	const nameElement = dom.querySelector("h1[itemprop=name]");
	const avatarElement = dom.querySelector("img#getAvatar");

	var authorInfo = {
		authorName: nameElement ? nameElement.textContent.trim() : "",
		avatar: avatarElement ? avatarElement.getAttribute("src") : ""
	}

	const videoListContainer = dom.querySelector("div.videoUList > ul");
	if (!videoListContainer) return { hasNextPage: hasNextPage, videos: resultArray };

	videoListContainer.childNodes.forEach((li) => {
		if (!li) return;

		const titleElement = li.querySelector("span.title a");
		if (!titleElement) return;

		var title = titleElement.textContent.trim();
		var videoUrl = titleElement.getAttribute("href");
		if (!videoUrl) return;

		const imgElement = li.querySelector("img");
		var thumbnailUrl = imgElement ? imgElement.getAttribute("src") : "";

		var videoId = li.getAttribute("data-video-id");
		if (!videoId) return;

		const durationElement = li.querySelector("var.duration");
		var duration = durationElement ? parseDuration(durationElement.textContent.trim()) : 0;

		const viewsElement = li.querySelector("div.videoDetailsBlock span.views var");
		var views = viewsElement ? parseStringWithKorMSuffixes(viewsElement.textContent.trim()) : 0;

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
		hasNextPage: hasNextPage,
		videos: resultArray
	};
}

function getVideoPager(path, params, page) {
	log(`getVideoPager page=${page}`, params)
	params = { ... params, page }

	const url = URL_BASE + path;
	const urlWithParams = `${url}${buildQuery(params)}`;

	var html = httpGET(urlWithParams, {});

	// Use different container IDs based on the path
	// Search pages use "videoSearchResult", home/category pages use "videoCategory"
	var containerId = path.includes("/search") ? "videoSearchResult" : "videoCategory";
	var vids = getVideos(html, containerId);
	
	return new PornhubVideoPager(vids.videos.map(v => {
		return new PlatformVideo({
			id: new PlatformID(PLATFORM, v.id, config.id),
			name: v.title ?? "",
			thumbnails: new Thumbnails([new Thumbnail(v.thumbnailUrl, 0)]),
			author: new PlatformAuthorLink(new PlatformID(PLATFORM, v.authorInfo.authorName, config.id),
				v.authorInfo.authorName,
				v.authorInfo.channel),
			datetime: undefined,
			duration: v.duration,
			viewCount: v.views,
			url: v.videoUrl,
			isLive: false
		});

	}), true, path, params, page);
}


function getVideos(html, ulId) {

	let node = domParser.parseFromString(html, "text/html");
	
	// Find the ul element with id ulId
	var ulElement = node.getElementById(ulId);

	var total = 1;

	var pagingIndicationElement = node.getElementsByClassName("showingCounter")[0];
	if (pagingIndicationElement !== undefined && pagingIndicationElement !== null) {
		var pagingIndication = pagingIndicationElement.textContent.trim();
		if (pagingIndication && typeof pagingIndication === 'string') {
			var indexOfTotalStr = pagingIndication.indexOf("of "); // "showing XX-ZZ of TOTAL"
			if (indexOfTotalStr !== -1) {
				total = parseInt(pagingIndication.substring(indexOfTotalStr + 3), 10);
				log(`getVideos total: ${total}`);
			}
		}
	}

	var resultArray = []

    if (ulElement) {
        // Get all li elements inside the ul with class "pcVideoListItem" (new class)
        const liElements = ulElement.querySelectorAll("li.pcVideoListItem");

        log(`getVideos found ${liElements.length} li elements`);

        // Iterate through each li element
        liElements.forEach(function (li) {
            // Get the data-video-id attribute of the li element for the videoId
            const videoId = li.getAttribute("data-video-id");

            // Ensure a valid videoId is found and it's not the ad element (which might have no data-video-id or a non-numeric id)
            if (videoId && !isNaN(videoId)) {
                // Find the first <a> tag inside the li which is the video link
                const aElement = li.querySelector('a.js-linkVideoThumb');

                if (aElement) {
                    // Get the "href" attribute as "videoUrl"
                    const videoUrl = URL_BASE + aElement.getAttribute('href');

                    // Find the <img> tag inside the <a>
                    const imgElement = aElement.querySelector('img.js-videoThumb');

                    if (imgElement) {
                        // Get the "src" attribute as "thumbnailUrl"
                        const thumbnailUrl = imgElement.getAttribute('src');

                        // Title can be from the img's alt or data-title, or the a tag's data-title, or the .thumbnailTitle span
                        const title = imgElement.getAttribute("alt") || imgElement.getAttribute("data-title") || aElement.getAttribute("data-title");

                        // Get the duration string from the <var> tag with class "duration"
                        const durationVar = aElement.querySelector(".duration");
                        const durationStr = durationVar ? durationVar.textContent.trim() : "0:00";
                        const duration = parseDuration(durationStr);

                        // Get the views string from the <var> tag inside the span with class "views"
                        const viewsSpan = li.querySelector(".views var");
                        const viewsStr = viewsSpan ? viewsSpan.textContent.trim() : "0";
                        const views = parseNumberSuffix(viewsStr);

                        // Get author information
                        const authorLink = li.querySelector(".usernameWrap a");
                        let authorInfo = {
                            channel: "",
                            authorName: ""
                        };
                        if (authorLink) {
                            authorInfo.channel = URL_BASE + authorLink.getAttribute("href");
                            authorInfo.authorName = authorLink.textContent.trim();
                        }

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

	log(resultArray.length + " videos found");

	return {
		totalElemsPages: undefined,
		videos: resultArray
	};

}


/**
 * HTTP GET wrapper that manages session lifecycle, bot detection bypass, and retries
 * Similar to Kick's callUrl function but adapted for PornHub's specific challenges
 * @param {string} url - The URL to fetch
 * @param {Object} options - Request options
 * @param {Object} options.headers - Optional custom headers to use instead of default headers
 * @param {boolean} options.requireToken - Whether this request requires a valid session token (default: false)
 * @param {boolean} options.parseJson - Whether to parse response as JSON (default: false)
 * @param {number} options.retries - Number of retry attempts on failure (default: 3)
 * @returns {string | Object} - Response body as string or parsed JSON
 * @throws {ScriptException}
 */
function httpGET(url, options = {}) {
	// Extract options with defaults
	var customHeaders = options.headers || null;
	var requireToken = options.requireToken || false;
	var parseJson = options.parseJson || false;
	var retries = options.retries !== undefined ? options.retries : 3;

	let lastError = null;
	let attempts = retries + 1; // +1 for the initial attempt

	// Use custom headers if provided, otherwise use default headers
	var requestHeaders = customHeaders || headers;

	while (attempts > 0) {
		try {
			// Step 1: Ensure we have a valid session
			if (headers["Cookie"].length === 0) {
				log("Session empty, refreshing...");
				refreshSession();
				// Update request headers with new cookies if using default headers
				if (!customHeaders) {
					requestHeaders = headers;
				} else {
					// Update cookie in custom headers
					customHeaders["Cookie"] = headers["Cookie"];
					requestHeaders = customHeaders;
				}
			} else if (requireToken && state.token === "") {
				log("Token required but empty, refreshing session...");
				refreshSession();
				// Update request headers after session refresh
				if (!customHeaders) {
					requestHeaders = headers;
				} else {
					customHeaders["Cookie"] = headers["Cookie"];
					requestHeaders = customHeaders;
				}
			}

			// Step 2: Make the HTTP request
			log("httpGET: Fetching " + url + " (attempt " + (retries - attempts + 2) + "/" + (retries + 1) + ")");
			const resp = http.GET(url, requestHeaders);

			// Step 3: Check response status
			if (!resp.isOk) {
				throw new ScriptException("Request [" + url + "] failed with code [" + resp.code + "]");
			}

			var body = resp.body;

			// Step 4: Check for bot detection challenge
			if (isBotChallenge(body)) {
				log("Bot challenge detected on attempt " + (retries - attempts + 2));

				// Solve the challenge
				var keyCookieValue = solveBotChallenge(body);

				if (!keyCookieValue) {
					throw new ScriptException("Failed to solve bot challenge");
				}

				// Update headers with KEY cookie
				headers["Cookie"] += "; KEY=" + keyCookieValue;

				// Update request headers
				if (!customHeaders) {
					requestHeaders = headers;
				} else {
					customHeaders["Cookie"] = headers["Cookie"];
					requestHeaders = customHeaders;
				}

				log("KEY cookie added, retrying request...");

				// Retry the request with the KEY cookie
				const retryResp = http.GET(url, requestHeaders);

				if (!retryResp.isOk) {
					throw new ScriptException("Retry request [" + url + "] failed with code [" + retryResp.code + "]");
				}

				body = retryResp.body;

				// Verify challenge was bypassed
				if (isBotChallenge(body)) {
					throw new ScriptException("Bot challenge persists after solving");
				}

				log("Bot challenge bypassed successfully");
			}

			// Step 5: Parse response if requested
			if (parseJson) {
				try {
					var json = JSON.parse(body);

					// Check for API errors
					if (json.error) {
						throw new ScriptException("API error: " + json.error);
					}

					return json;
				} catch (parseError) {
					log("Failed to parse JSON: " + parseError);
					throw new ScriptException("JSON parse error: " + parseError);
				}
			}

			// Step 6: Return successful response
			return body;

		} catch (error) {
			lastError = error;
			attempts--;

			log("Request failed: " + error + " (attempts remaining: " + attempts + ")");

			// If we have more attempts and the error is recoverable, try refreshing session
			if (attempts > 0) {
				if (error.toString().includes("401") || error.toString().includes("403") ||
				    error.toString().includes("session") || error.toString().includes("token")) {
					log("Attempting session refresh before retry...");
					try {
						refreshSession();
						// Update request headers after refresh
						if (!customHeaders) {
							requestHeaders = headers;
						} else {
							customHeaders["Cookie"] = headers["Cookie"];
							requestHeaders = customHeaders;
						}
					} catch (refreshError) {
						log("Session refresh failed: " + refreshError);
					}
				}

				// Small delay before retry to avoid rate limiting
				log("Waiting 1 second before retry...");
				bridge.sleep(1000);
				continue;
			}

			// All retry attempts exhausted
			log("Request failed after " + (retries + 1) + " attempts");
			throw lastError;
		}
	}

	// Should never reach here, but just in case
	throw lastError || new ScriptException("Request failed for unknown reason");
}

function parseNumberSuffix(numStr) {

	var mul = 1;
	if (numStr.includes("K")) {
		mul = 1000;
	}
	if (numStr.includes("M")) {
		mul = 1000000;
	}

	var out = parseFloat(numStr.slice(0, -1)) * mul;
	return out;
}

function parseDuration(durationStr) {
	var splitted = durationStr.split(":");
	var mins = parseInt(splitted[0]);
	var secs = parseInt(splitted[1]);

	return 60 * mins + secs;
}

log("LOADED");
