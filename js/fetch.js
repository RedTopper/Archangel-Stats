const NOTIFICATION_ENABLED = "notifications-enabled";
const NOTIFICATION_MIN = "notifications-min";

let notifEnabled;
let notifMin;
let sentNotification = false;

function statisticError(status, type, target) {
	let $error = $("#js-request-error");
	let $number = $(target);
	let $title = $("title");

	switch(status) {
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
	$number.text("Unknown");
	$error.show();
}

function statisticSuccessMatchmaking(json) {
	let $number = $("#js-number-playing");
	let $information = $("#js-statistics-content");

	$information.empty();
	if (!("total" in json) || !("averageWaitTime" in json) || !("lastStatisticsTime" in json)) {
		statisticError(null, "parsererror", "Malformed statistics data!");
		return;
	}

	let regions = [];
	if ("regions" in json) {
		let reg = json.regions;
		for (let key in reg) {
			if (reg.hasOwnProperty(key)) {
				regions.push({
					"region": key,
					"players": reg[key]
				})
			}
		}
	}

	if (regions.length > 0) {
		$information.append("<span>Region (Players):</span>");
		let list = $("<ul class='information-list'></ul>");
		regions.forEach(function (region) {
			let formatted = region.region + " (" + region.players + ")";
			list.append($("<li></li>").text(formatted));
		});
		$information.append(list);
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

	$information.append($("<span></span>").text(time));
	$number.text(json.total);
	$("title").text("(" + json.total + ") Archangel VR: Matchmaking");
	statisticsComplete(new Date(json.lastStatisticsTime));
}

function statisticSuccessPlayers(json) {
	if (!("total" in json) || !("lastStatisticsTime" in json)) {
		statisticError(null, "parsererror", "Malformed player data!");
		return;
	}

	$("#js-number-online").text(json.total);
	statisticsComplete(new Date(json.lastStatisticsTime));
}

function statisticsComplete(date) {
	$("#js-request-error").hide();
	$("#js-last-updated-time").text("Last Updated: " + date.toLocaleDateString() + " / " +date.toLocaleTimeString());

	//make loading symbol stick around for a little bit so the
	//user knows the app is actually doing something
	setTimeout(function () {
		$(".loading-outer").hide();
	}, 200);
}

function notificationText($elem, status) {
	switch (status) {
		case "yes":
			$elem.text("Disable Notifications");
			$elem.removeAttr("disabled");
			break;
		case "no":
			$elem.text("Enable Notifications");
			$elem.removeAttr("disabled");
			break;
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
	if (notifEnabled === "yes") {
		new Notification(title, {
			body: body,
			icon: icon
		});
	}
}

function notificationRequest($elem, result) {
	if (result === "granted") {
		notifEnabled = "yes";
		notificationText($elem, notifEnabled);
		notificationSpawn(
			"You have chosen to enable notifications. We'll let you know when there is "
			+ notifMin + " or more players in the matchmaking queue.",
			"img/icon.jpg",
			"Notifications"
		);
	} else {
		notifEnabled = "no";
		notificationText($elem, "denied");
	}

	localStorage.setItem(NOTIFICATION_ENABLED, notifEnabled);
}

function setup() {
	//grab all settings from local storage
	notifEnabled = localStorage.getItem(NOTIFICATION_ENABLED);
	notifMin = localStorage.getItem(NOTIFICATION_MIN);

	//cache all jquery objects
	let $notifEnabled = $("#js-notification-toggle");
	let $notifMin = $("#js-notification-minimum");
	let $stats = $("#js-statistics-toggle");
	let $settings = $("#js-settings-toggle");

	//default values
	if (notifMin === null) {
		notifMin = "1";
		localStorage.setItem(NOTIFICATION_MIN, notifMin);
	}

	if (notifEnabled === null) {
		notifEnabled = "no";
		localStorage.setItem(NOTIFICATION_ENABLED, notifEnabled);
	}

	//set jquery object values
	$notifMin.val(notifMin);
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

	$notifEnabled.click(function () {
		if (notifEnabled === "yes") {
			notifEnabled = "no";
		} else if (notifEnabled === "no") {
			notificationText($notifEnabled, "pending");
			Notification.requestPermission().then(function(result) {
				notificationRequest($notifEnabled, result);
			});
		}

		localStorage.setItem(NOTIFICATION_ENABLED, notifEnabled);
		notificationText($notifEnabled, notifEnabled);
	})
}

function update() {
	$(".loading-outer").show();

	$.ajax({
		"url": "https://aa.sdawsapi.com/matchmaking/stats",
		"dataType": "json",
		"crossDomain": true,
		"timeout": 2000,
		"success": statisticSuccessMatchmaking,
		"error": function(xhr, status, type) {
			statisticError(status, type, "#js-number-playing");
		}
	});

	$.ajax({
		"url": "https://aa.sdawsapi.com/players/stats",
		"dataType": "json",
		"crossDomain": true,
		"timeout": 2000,
		"success": statisticSuccessPlayers,
		"error": function(xhr, status, type) {
			statisticError(status, type, "#js-number-online");
		}
	})
}

$(function() {
	setup();
	update();
	setInterval(update, 10000);
});
