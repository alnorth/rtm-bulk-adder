function RTM(apiKey, sharedSecret) {

	var token,
		username,
		timeline,
		apiCallCount = 0;

	function addSig(values) {
		var sortedKeys = [],
			key,
			concatenatedKeysAndValues = "",
			i;
		for(key in values) {
			if(values.hasOwnProperty(key)) {
				sortedKeys.push(key);
			}
		}
		sortedKeys.sort();
		
		for(i = 0; i < sortedKeys.length; i++) {
			key = sortedKeys[i];
			concatenatedKeysAndValues += key;
			concatenatedKeysAndValues += values[key];
		}
		
		values["api_sig"] = hex_md5(sharedSecret + concatenatedKeysAndValues);
	}
	
	function authenticateUser() {
		var url = "http://www.rememberthemilk.com/services/auth/",
			qs = {api_key: apiKey, perms: "write"};
		
		addSig(qs);
		
		url += "?" + $.param(qs);
		
		document.location = url;
	}
	this.authenticateUser = authenticateUser;
	
	function getParameterByName(name) {
		name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
		var regexS = "[\\?&]" + name + "=([^&#]*)";
		var regex = new RegExp(regexS);
		var results = regex.exec(window.location.href);
		if(results == null)
			return "";
		else
			return decodeURIComponent(results[1].replace(/\+/g, " "));
	}
	this.getParameterByName = getParameterByName;
	
	function ensureToken(callback) {
		var frob = getParameterByName("frob"),
			that = this;
						
		if(frob !== "") {
			apiCall("rtm.auth.getToken", {frob: frob}, false, function(data) {
				if(data.rsp.stat === "ok") {
					localStorage.setItem("token", data.rsp.auth.token);
					localStorage.setItem("username", data.rsp.auth.user.username);
					
					token = data.rsp.auth.token;
					username = data.rsp.auth.user.username;
					
					// Go to this page without frob on the query string so that people won't bookmark it with the frob
					document.location = document.location.href.split("?")[0];
				} else {
					alert("There was a problem getting a token from Remember the Milk: " + data.rsp.err.msg);
				}
			});
		} else if(!localStorage.getItem("token") || !localStorage.getItem("username")) {
			alert("In order to use this page properly you must authorise it to access your Remember the Milk account. You are being redirected to Remember the Milk so that you can do this.");
			authenticateUser();
		} else {
			apiCall("rtm.auth.checkToken", {auth_token: localStorage.getItem("token")}, false, function(data) {
				if(data.rsp.stat === "ok") {
					token = localStorage.getItem("token");
					username = localStorage.getItem("username");
					callback();
				} else {
					alert("Your token from Remember the Milk has expired. You are being redirected to Remember the Milk so that you can re-authorise this page.");
					authenticateUser();
				}
			});
		}
	}
	this.ensureToken = ensureToken;
	
	function ensureTimeline(callback) {
		if(!timeline) {
			apiCall("rtm.timelines.create", {}, true, function(data) {
				timeline = data.rsp.timeline;
				callback();
			});
		} else {
			callback();
		}
	}
	
	function addTask(text, callback) {
		ensureTimeline(function() {
			apiCall("rtm.tasks.add", {timeline: timeline, name: text, parse: 1}, true, callback);
		});
	}
	this.addTask = addTask;
	
	function apiCall(method, params, authenticated, callback) {
		var url = "http://api.rememberthemilk.com/services/rest/",
			functionName = "rtmJsonp" + (new Date()).getTime() + "_" + apiCallCount;
			
		apiCallCount++;
		
		params = params || {};
		params["format"] = "json";
		params["method"] = method;
		params["api_key"] = apiKey;
		params["callback"] = functionName;
		if(authenticated) {
			params["auth_token"] = token;
		}
		
		addSig(params);
		url += "?" + $.param(params);
		
		window[functionName] = function(data) {
			$("#" + functionName).remove();
			delete window[functionName];
			if(callback) {
				callback(data);
			}
		}
		
		var head = document.getElementsByTagName('head')[0];
		var script = document.createElement("script");
		script.type = "text/javascript";
		script.src = url;
		script.id = functionName;
		
		head.appendChild(script);
	}
	this.apiCall = apiCall;
	
	function getUsername() {
		return username;
	}
	this.getUsername = getUsername;
}