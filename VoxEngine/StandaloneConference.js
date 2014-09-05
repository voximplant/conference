var voxConf, // VoxConference instance
    conferenceId = null, // conference id
	startType, // conference start type
   	eventType, // event type for conference re-launch
    redial_pId, // conference participant id (for redial)
	authorized = false, // authorized flag
	WEBSERVICE_URL = "path/to/shim.php", // URL to webservice
	sessionCookie = null, // session id for communication with webservice (shim.php) after successful auth
	t3,
    ms_url; // media_session_access_url

/**
*	Handle Session Start
*/
VoxEngine.addEventListener(AppEvents.Started, function (e) {
	// Create VoxConference instance
	voxConf = new VoxConference();
	// Get media_session_access_url for this session
  	ms_url = e.accessURL;
  	// If session was started via HTTP we have customData, if it was started by incoming call - no customData
	try {
		data = JSON.parse(VoxEngine.customData());
		conferenceId = data.conference_id;
		startType = data.start_type;
      	if (typeof data.event != 'undefined') eventType = data.event;
      	if (typeof data.pId != 'undefined') redial_pId = data.pId;
	} catch (e) {
		startType = "sip";           	
	}
	// Authorization on webservice (shim.php)
	var opts = new Net.HttpRequestOptions();
	opts.method = "GET";
	opts.headers = ["User-Agent: VoxImplant"];
	// Login / password for authorization
	var authInfo = {
		username: "admin",
		password: "admin"
	};
	Net.httpRequest(WEBSERVICE_URL + "?action=authorize&params=" + encodeURIComponent(JSON.stringify(authInfo)), authResult, opts);
});

/**
*	Handle Incoming Call
*/
VoxEngine.addEventListener(AppEvents.CallAlerting, function (e) {
	// If participant data hasn't been loaded yet from webservice just add calls to array for further processing
	if (voxConf.participants() == null) {   
		// e.destination contains full conference name conf + id, get only id from it
		conferenceId = e.destination.replace('conf', '');
		voxConf.addConfCall({
			call_id: e.call.id(),
			call: e.call,
			input: '',
			state: 'waiting'
		});
	} else {
		// Already have participant data - process incoming call immediately
		voxConf.addConfCall({
			call_id: e.call.id(),
			call: e.call,
			input: '',
			state: 'in_process'
		});
		voxConf.processIncomingCall(e.call);
	}
});

/**
* Handle authorization request result
*/
function authResult(e) {
	if (e.code == 200) {
		for (var i in e.headers) {
			if (e.headers[i].key == "Set-Cookie") {
				sessionCookie = e.headers[i].value;
				sessionCookie = sessionCookie.substr(0, sessionCookie.indexOf(';'));
			}
		}
		if (sessionCookie == null) {
			Logger.write("No session header found.");
			VoxEngine.terminate();
		}
		if (JSON.parse(e.text).result == "AUTHORIZED") {
			// Authorized succesfully
			authorized = true;
			// If conference was launched via HTTP or we already have conferenceId
          	if (startType == 'http' || conferenceId != null) {
          		// Launched with incoming call - save media_session_access_url in DB
              	if (startType == 'sip') saveMSURL();
              	// Load participant data from webservice
            	getParticipants();
            } else {
            	// Wait until we have conferenceId
				t3 = setInterval(checkConferenceId, 1000);
			}
		} else {
			Logger.write("Authorization failed");
          	VoxEngine.terminate();
		}
    } else {
		Logger.write("Auth HTTP request failed: " + e.code);
		VoxEngine.terminate();
    }
}

/**
* Call participant
*/
function processRedial(pId) {
	var phone = '',
		participants = voxConf.participants();
	//  Search for participant with id = pId
	for (var k in participants) {
		if (participants[k].id == pId) {
			phone = participants[k].phone;
		}
	}
	// Not found
	if (phone == '') return false;
	// Found - call and start processing
	var call = VoxEngine.callPSTN(phone, voxConf.getConfNumber());
	voxConf.addConfCall({
		call_id: call.id(),
		call: call,
		input: '',
		state: 'in_process',
		participant_id: pId
	});
	voxConf.processOutboundCall(call);
	return true;
}

/**
* Check conferenceId, if it exists - incoming call has arrived and session was launched
*/
function checkConferenceId() {
	if (conferenceId != null) {
		clearInterval(t3);
		// Save media_session_access_url in DB
      	if (startType == 'sip') saveMSURL();
      	// Load participant data from webservice
		getParticipants();
	}
}

/**
* Save media_session_access_url in DB using webservice
*/
function saveMSURL() {
  	var opts = new Net.HttpRequestOptions();
	opts.method = "POST";
	opts.headers = ["Cookie: " + sessionCookie];
	var requestInfo = {
		conference_id: conferenceId,
      	ms_url: ms_url
	};
	Net.httpRequest(WEBSERVICE_URL + "?action=save_ms_url&params=" + encodeURIComponent(JSON.stringify(requestInfo)), saveMSURLresult, opts);
}

// save_ms_url request result handler
function saveMSURLresult(e) {
  if (e.code == 200) {
    // Everything is OK
    Logger.write(e.text);
  } else {
    // Something went wrong
    Logger.write("Couldn't save ms_url in DB");
  }
}

/**
* Load participant data from webservice
*/
function getParticipants() {
	var opts = new Net.HttpRequestOptions();
	opts.method = "GET";
	opts.headers = ["Cookie: " + sessionCookie];
	var requestInfo = {
		conference_id: conferenceId
	};
	Logger.write(WEBSERVICE_URL + "?action=get_participants&params=" + JSON.stringify(requestInfo));
	Net.httpRequest(WEBSERVICE_URL + "?action=get_participants&params=" + encodeURIComponent(JSON.stringify(requestInfo)), getParticipantsResult, opts);
}

/**
*  get_participants request result handler
*/
function getParticipantsResult(e) {
	if (e.code == 200) {
		if (typeof e.text == 'undefined') {
			// Something went wrong
			Logger.write('No participants found.');
			VoxEngine.terminate();
			return;
		}
		var result = JSON.parse(e.text);
		if (typeof result.error != 'undefined') {
			// Something went wrong
		} else {
			// Conference and participants data
			var participants = result.result.participants,
				calleridAuth = (result.result.conference.callerid_auth == "1"),
				anonymousAccess = (result.result.conference.anonymous_access == "1"),
				accessCode = result.result.conference.access_code,
				active = (result.result.conference.active == "1"),
				accessNumber = result.result.conference.access_number;
			// Initialize VoxConference instance
			voxConf.init(conferenceId, accessCode, anonymousAccess, calleridAuth, active, participants, accessNumber);
			// Handle calls arrived before we received data from webservice
			voxConf.processWaitingCalls();
			// If session was launched via HTTP - make outbound calls to participants with auto_call = 1
            if (startType == "http") {            	
                if (eventType == 'redial') voxConf.makeOutboundCalls(redial_pId); // Session was started by this call to particular participant
                else voxConf.makeOutboundCalls(); // Session was started together with conference
            }

		}
	} else Logger.write("Participants HTTP request failed: " + e.code);
}

/**
* Update participants after adding new participant
*/
function updateParticipants(e, pId) {
  if (e.code == 200) {
    if (typeof e.text == 'undefined') return; // Something went wrong
    var result = JSON.parse(e.text);
    if (typeof result.error != 'undefined') {
		// Something went wrong
	} else {
		// Update participants
    	voxConf.updateParticipants(result.result.participants);
    	// Call new participant
      	processRedial(pId);
    }
  }
}

/**
* Handle commands sent using media_session_access_url
*/
VoxEngine.addEventListener(AppEvents.HttpRequest, function (data) {
	// Request URL example: media_session_access_url + /command=mute_participant/pId=100
	// в data.path will contain only command=mute_participant/pId=100
	var params = data.path.split("/"),
		command = null,
		pId = null,
        options = null;
    // Parse params and get command, pId, options if specified
	for (var i in params) {
		var kv = params[i].split("=");
		if (kv.length > 1) {
			if (kv[0] == "command") command = kv[1];
			if (kv[0] == "pId") pId = kv[1];
          	if (kv[0] == "options") options = kv[1];
		}
	}
	// All conference calls
	var calls = voxConf.calls();
	switch (command) {
	// Get call data and send back - for visualization in Manager UI
	case "gather_info":
		var result = [];
		for (var i in calls) {
			if (typeof calls[i].participant_id != 'undefined') result.push({
				state: calls[i].call.state(),
				participant_id: calls[i].participant_id
			});
		}
		return JSON.stringify(result);
		break;

	// Disconnect participant
	case "disconnect_participant":
		for (var i in calls) {
			if (calls[i].participant_id == pId) {
				calls[i].call.hangup();
				return true;
			}
		}
		return false;
		break;

	// Mute participant
	case "mute_participant":
		for (var i in calls) {
			if (calls[i].participant_id == pId) {
				calls[i].call.stopMediaTo(voxConf.getConfObj());
				return true;
			}
		}
		return false;
		break;

	// Unmute participant
	case "unmute_participant":
		for (var i in calls) {
			if (calls[i].participant_id == pId) {
				calls[i].call.sendMediaTo(voxConf.getConfObj());
				return true;
			}
		} 
		return false;
		break;
    
   	// Redial participant
    case "redial_participant":    
    	// After participant was added we need to reload participant data from webservice
        if (options == 'reload_participants') {
        	var opts = new Net.HttpRequestOptions();
            opts.method = "GET";
            opts.headers = ["Cookie: " + sessionCookie];
            var requestInfo = {
                conference_id: conferenceId
            };
            Net.httpRequest(WEBSERVICE_URL + "?action=get_participants&params=" + encodeURIComponent(JSON.stringify(requestInfo)), function(e) {
            	// Update participants list
            	updateParticipants(e, pId);
            }, opts);
          	return true;
        } else {
        	// Redial existing participant
          	return processRedial(pId);          	
    	}
        break;
     
	}

});

/**
* Remove media_session_access_url (ms_url) from DB while session termination
*/
VoxEngine.addEventListener(AppEvents.Terminating, function(e) {
  	var opts = new Net.HttpRequestOptions();
	opts.method = "POST";
	opts.headers = ["Cookie: " + sessionCookie];
	Logger.write("HEADERS: " + opts.headers);
	var requestInfo = {
		conference_id: conferenceId,
      	ms_url: ''
	};
	Logger.write("Terminating the session, update ms_url in database");
	Net.httpRequest(WEBSERVICE_URL + "?action=save_ms_url&params=" + encodeURIComponent(JSON.stringify(requestInfo)), function(e) {}, opts);
});