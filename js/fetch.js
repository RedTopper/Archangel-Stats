//Storage keys
const STORAGE_YES = "yes";
const STORAGE_NO = "no";
const NOTIFICATION_ENABLED = "notifications-enabled";
const NOTIFICATION_MIN = "notifications-min";
const API_CALL = "api-call";

//Fixed settings
const UPDATE_PERIOD_MS = 10000;
const UPDATE_DELAY_MS = 500;

//Game modes
const MODE_ANY = "Anything";
const MODE_COOP = "CO-OP";
const MODE_TDM = "TDM";
const MODE_TDM_1V1 = "TDM (1v1)";
const MODE_TDM_2V2 = "TDM (2v2)";
const MODE_UNKNOWN = "Custom";
const MODES = {
	"1b815e56-0f23-4958-aaf3-88940310ddfa": MODE_TDM,
	"9b7c1980-fd85-440e-96f9-7464a0878d45": MODE_COOP
};

//Skydance Products
const PRODUCT_FREE = "Free";
const PRODUCT_FULL = "Full";
const PRODUCT_UNKNOWN = "Other";
const PRODUCTS = {
	"26d837b1-ca9d-46a9-9e72-15d08e1e1c95": PRODUCT_FREE,
	"a1ce8ec8-a2c0-44dd-8f1f-a624bbe4f15e": PRODUCT_FULL
};

//Global storage variables
let notifEnabled;
let notifMin;
let apiCall;
let wackyStats;
let sentNotification = false;

function statisticMatchmaking(json) {
	if (!("total" in json) || !("averageWaitTime" in json) || !("lastStatisticsTime" in json)) {
		statisticError("other", "Malformed statistics data!");
		return;
	}

	let $number = $("#js-number-playing");
	let $region = $("#js-region-statistics");
	let $time = $("#js-time-statistics");
	$region.empty();
	$time.empty();

	if ("regions" in json) {
		generateUnorderedList($region, "Searching Regions:", json.regions);
	}

	if (!sentNotification && json.total >= notifMin) {
		notificationSpawn(
			"There are " + json.total + " players matchmaking right now!",
			"img/icon.jpg",
			"Player Alert"
		);
		sentNotification = true;
	}

	if (sentNotification && json.total < notifMin) {
		sentNotification = false;
	}

	let time =  "Wait Time: ~" + Math.ceil(json.averageWaitTime/1000) + " s";

	$time.append($("<span></span>").text(time));
	$number.text(json.total);
	$("title").text("(" + json.total + ") Archangel VR: Matchmaking");
	statisticsComplete(new Date(json.lastStatisticsTime));
}

function statisticPlayers(json) {
	if (!("total" in json) || !("lastStatisticsTime" in json)) {
		statisticError("other", "Malformed player data!");
		return;
	}

	let $products = $("#js-product-statistics");
	$products.empty();

	if ("Products" in json) {
		let parsed = {};
		let products = json.Products;
		for (let product in products) {
			if (products.hasOwnProperty(product)) {
				//Check if the product is known, if it isn't, add it to unknown.
				//If we have multiple unknowns, accumulate them together.
				if (product in PRODUCTS) {
					addOrSet(parsed, PRODUCTS[product], products[product]);
				} else {
					addOrSet(parsed, PRODUCT_UNKNOWN, products[product]);
				}
			}
		}

		generateUnorderedList($products, "Online Products:", parsed);
	}

	$("#js-number-online").text(json.total);
	statisticsComplete(new Date(json.lastStatisticsTime));
}

function statisticGameModes(json) {
	if (!Array.isArray(json)) {
		statisticError("other", "Malformed mode data!");
	}

	let $mode = $("#js-mode-statistics");
	$mode.empty();

	let parsed = {};
	json.forEach(function(player) {
		if ("version" in player && "uid" in player && "gameVersion" in player) {
			//Looks close enough to a player
			if ("searchParameters" in player && "maximumTeamSize" in player) {
				//We have some specific search parameters.
				player.searchParameters.forEach(function (search) {
					if ("parameter" in search
						&& "name" in search.parameter
						&& "value" in search.parameter
						&& search.parameter.name === "GAME_MODE") {

						let mode = MODE_UNKNOWN;
						if (MODES.hasOwnProperty(search.parameter.value)) {
							mode = MODES[search.parameter.value];
						}

						switch (mode) {
							case MODE_TDM:
								if (player.maximumTeamSize == 2) {
									addOrSet(parsed, MODE_TDM_2V2, 1);
								} else if (player.maximumTeamSize == 1) {
									addOrSet(parsed, MODE_TDM_1V1, 1);
								} else {
									addOrSet(parsed, MODE_TDM, 1);
								}
								break;
							case MODE_COOP:
								addOrSet(parsed, MODE_COOP, 1);
								break;
							case MODE_UNKNOWN:
							default:
								addOrSet(parsed, MODE_UNKNOWN, 1);
						}
					}
				});
			} else {
				//We don't care what we get dropped into.
				addOrSet(parsed, MODE_ANY, 1);
			}
		}
	});

	if (json.length > 0) {
		generateUnorderedList($mode, "Searching Modes:", parsed);
	}

	statisticsComplete()
}

function statisticError(status, type, target = null) {
	let $error = $("#js-request-error");
	let $title = $("title");

	switch(status) {
		case "other":
			$error.text(type);
			break;
		case "parsererror":
			$error.text("Malformed matchmaking data!");
			break;
		case "error":
			$error.text(type === "" ? "Unknown HTTP Error" : "HTTP Error: " + type);
			break;
		default:
			$error.text("Unknown error, see console.")
	}

	console.error(`Status: '${status}' Error: '${type}'`);
	$title.text("(?) Archangel VR: Matchmaking");

	if (target !== null) {
		$(target).text("Unknown");
	}

	$error.show();
}

function statisticsComplete(date = null) {
	$("#js-request-error").hide();

	if (date !== null) {
		$("#js-last-updated-time").text("Last Updated: " + date.toLocaleDateString() + " / " + date.toLocaleTimeString());
	}

	//make loading symbol stick around for a little bit so the
	//user knows the app is actually doing something
	setTimeout(function () {
		$(".loading-outer").hide();
	}, 100);
}

function notificationText($elem, status) {
	switch (status) {
		case STORAGE_YES:
			$elem.text("Disable Notifications");
			$elem.removeAttr("disabled");
			break;
		case STORAGE_NO:
			$elem.text("Enable Notifications");
			$elem.removeAttr("disabled");
			break;

		//Other statuses that may occur, but are temporary.
		case "denied":
			$elem.text("Notifications Blocked");
			$elem.attr("disabled", "disabled");
			break;
		case "pending":
			$elem.text("Permission Pending...");
			$elem.attr("disabled", "disabled");
			break;
		default:
			$elem.text("Notification Error...");
			$elem.attr("disabled", "disabled");
	}
}

function notificationSpawn(body, icon, title) {
	if (notifEnabled === STORAGE_YES) {
		new Notification(title, {
			body: body,
			icon: icon
		});
	}
}

function notificationRequest($elem, result) {
	if (result === "granted") {
		notifEnabled = STORAGE_YES;
		notificationText($elem, notifEnabled);
		notificationSpawn(
			"You have chosen to enable notifications. We'll let you know when there is "
			+ notifMin + " or more players in the matchmaking queue.",
			"img/icon.jpg",
			"Notifications"
		);
	} else {
		notifEnabled = STORAGE_NO;
		notificationText($elem, "denied");
	}

	localStorage.setItem(NOTIFICATION_ENABLED, notifEnabled);
}

function setup() {
	//grab all settings from local storage
	notifEnabled = localStorage.getItem(NOTIFICATION_ENABLED);
	notifMin = localStorage.getItem(NOTIFICATION_MIN);
	apiCall = localStorage.getItem(API_CALL);

	//cache all jquery objects
	let $notifEnabled = $("#js-notification-toggle");
	let $notifMin = $("#js-notification-minimum");
	let $apiCall = $("#js-api-call");
	let $wackyStats = $("#js-optimism");

	let $stats = $("#js-statistics-toggle");
	let $settings = $("#js-settings-toggle");

	//default values
	if (notifMin === null) {
		notifMin = "1";
		localStorage.setItem(NOTIFICATION_MIN, notifMin);
	}

	if (notifEnabled === null) {
		notifEnabled = STORAGE_NO;
		localStorage.setItem(NOTIFICATION_ENABLED, notifEnabled);
	}

	if (apiCall === null) {
		apiCall = STORAGE_YES;
		localStorage.setItem(API_CALL, apiCall);
	}

	//set jquery object values
	$notifMin.val(notifMin);
	$notifEnabled.prop("checked", apiCall === STORAGE_YES);
	notificationText($notifEnabled, notifEnabled);

	//tie events to jquery objects
	$stats.click(function() {
		$("#js-statistics-content").toggle();
	});

	$settings.click(function() {
		$("#js-settings-content").toggle();
	});

	$notifMin.change(function () {
		notifMin = $notifMin.val();
		localStorage.setItem(NOTIFICATION_MIN, notifMin);
	});

	$apiCall.change(function () {
		apiCall = $apiCall.is(':checked') ? STORAGE_YES : STORAGE_NO;
		localStorage.setItem(API_CALL, apiCall);
	});

	$wackyStats.change(function () {
		wackyStats = $wackyStats.is(':checked') ? STORAGE_YES : STORAGE_NO;
	});

	$notifEnabled.click(function () {
		if (notifEnabled === STORAGE_YES) {
			notifEnabled = STORAGE_NO;
		} else if (notifEnabled === STORAGE_NO) {
			notificationText($notifEnabled, "pending");
			Notification.requestPermission().then(function(result) {
				notificationRequest($notifEnabled, result);
			});
		}

		localStorage.setItem(NOTIFICATION_ENABLED, notifEnabled);
		notificationText($notifEnabled, notifEnabled);
	})
}

function addOrSet(obj, key, value) {
	if (key in obj) {
		obj[key] += value;
	} else {
		obj[key] = value;
	}
}

function generateUnorderedList($node, title, objRaw) {
	let obj = {};

	//Since the API is unreliable in it's ordering, sort the
	//parsed array in a new object.
	Object.keys(objRaw).sort().forEach(function(key) {
		obj[key] = objRaw[key];
	});

	$node.append("<span>" + title + "</span>");
	let $list = $("<ul class='information-list'></ul>");
	for (let key in obj) {
		if (obj.hasOwnProperty(key)) {
			let formatted = key + ": " + obj[key];
			$list.append($("<li></li>").text(formatted));
		}
	}
	$node.append($list);
}

$(function() {
	setup();

	let periodic = [
		function() {
			if (wackyStats === STORAGE_YES) {
				let total = Math.floor(Math.random() * 30) + 85;
				statisticMatchmaking({
					"total": total,
					"averageWaitTime": "1337",
					"lastStatisticsTime": null
				});
				return;
			}

			$(".loading-outer").show();
			$.ajax({
				"url": "https://aa.sdawsapi.com/matchmaking/stats",
				"dataType": "json",
				"crossDomain": true,
				"timeout": 2000,
				"success": statisticMatchmaking,
				"error": function(xhr, status, type) {
					statisticError(status, type, "#js-number-playing");
				}
			});
		},

		function() {
			if (wackyStats === STORAGE_YES) {
				let total = Math.floor(Math.random() * 50 + 875);
				let paid = Math.floor(Math.random() * 10) + 100;
				statisticPlayers({
					"total": total,
					"lastStatisticsTime": null,
					"Products": {
						"26d837b1-ca9d-46a9-9e72-15d08e1e1c95": total - paid,
						"a1ce8ec8-a2c0-44dd-8f1f-a624bbe4f15e": paid
					}
				});
				return;
			}

			$(".loading-outer").show();
			$.ajax({
				"url": "https://aa.sdawsapi.com/players/stats",
				"dataType": "json",
				"crossDomain": true,
				"timeout": 2000,
				"success": statisticPlayers,
				"error": function(xhr, status, type) {
					statisticError(status, type, "#js-number-online");
				}
			})
		},

		function() {
			if (apiCall === STORAGE_NO || wackyStats === STORAGE_YES) {
				$("#js-mode-statistics").empty();
				return;
			}

			$(".loading-outer").show();
			$.ajax({
				"url": "https://aa.sdawsapi.com/matchmaking",
				"dataType": "json",
				"crossDomain": true,
				"timeout": 2000,
				"success": statisticGameModes,
				"error": function (xhr, status, type) {
					statisticError(status, type);
				}
			})
		},
	];

	//Delay each request by a little bit to spread out how many calls are made to the API
	//I don't know if this will actually help, but I thought I would at least make an attempt.
	for(let i = 0; i < periodic.length; i++) {
		setTimeout(function() {
			periodic[i]();
			setInterval(function() {
				periodic[i]()
			}, UPDATE_PERIOD_MS);
		}, UPDATE_DELAY_MS * i);
	}
});
