// Enable VoxImplant modules
require(Modules.Conference); // Audio conferencing module
require(Modules.Player); // Audio player module

/**
* Class
*/
VoxConference = function () {

	var conferenceId,
		accessCode,
		anonymousAccess,
		calleridAuth,
		active,
		participants = null,
		number,
		conf,
		calls = [],
		t1, t2,
		music = null,
		BEEP_URL = "path/to/beep.mp3",
		MUSIC_URL = "path/to/ambientmusic.mp3";

	// Initialize variables
	this.init = function (id, code, a_access, c_auth, a, p, num) {
		conferenceId = id; // conference id
		number = num; // conference access number
		accessCode = code; // conference access code
		anonymousAccess = a_access; // anonymous access
		calleridAuth = c_auth; // authorization by caller id 
		participants = p; // participants
		active = a;
		// Create conference
		conf = VoxEngine.createConference();
	}

	// Get participants
	this.participants = function () {
		return participants;
	}

	// Update participants
	this.updateParticipants = function (newdata) {
		participants = newdata;
	}

	// Get conference calls
	this.calls = function () {
		return calls;
	}

	// Get conference access number
	this.getConfNumber = function () {
		return number;
	}

	// Get conference object instance
	this.getConfObj = function () {
		return conf;
	}

	// New incoming call processing
	this.processIncomingCall = function (call) {
		// Answer call
		call.answer();
		// Add event listeners
		this.handleCallConnected = this.handleCallConnected.bind(this);
		call.addEventListener(CallEvents.Connected, this.handleCallConnected);
		call.addEventListener(CallEvents.Disconnected, function (e) {
			// If call disconnected - remove it from calls and change status in participants
			var pid = this.getConfCall(e.call).participant_id;
			Logger.write("Participant id " + pid + " has left the conf");
			this.participantLeft(pid);
			for (var i = 0; i < calls.length; i++) {
				if (calls[i].call == e.call) {
					calls.splice(i, 1);
					break;
				}
			}
			// Play music if there is only one participant in the conference
			this.ambientMusic();
		}.bind(this));
	}

	// Process new outbound call
	this.processOutboundCall = function (call) {
		// Answer call
		call.answer();
		// Add event listeners
		this.handleOutboundCallConnected = this.handleOutboundCallConnected.bind(this);
		call.addEventListener(CallEvents.Connected, this.handleOutboundCallConnected);
		call.addEventListener(CallEvents.Disconnected, function (e) {
			// If call disconnected - remove it from calls and change status in participants
			var pid = this.getConfCall(e.call).participant_id;
			Logger.write("Participant id " + pid + " has left the conf");
			this.participantLeft(pid);
			for (var i = 0; i < calls.length; i++) {
				if (calls[i].call == e.call) {
					calls.splice(i, 1);
					break;
				}
			}
			// Play music if there is only one participant in the conference
			this.ambientMusic();
		}.bind(this));
		call.addEventListener(CallEvents.Failed, function (e) {
			// Call failed
			var pid = this.getConfCall(e.call).participant_id;
			Logger.write("Couldnt connect participant id " + pid);
		}.bind(this));
	}

	// Check if participant with specified passcode exists
	this.participantExists = function (passcode) {
		Logger.write("Check if participant exists, passcode: " + passcode);
		for (var i = 0; i < participants.length; i++) {
			if (participants[i].passcode == passcode && participants[i].connected != true) {
				participants[i].connected = true;
				return participants[i].id;
			}
		}
		return false;
	}

	// Check if participant with specified param/value exists
	this.participantWithParamExists = function (param, value) {
		Logger.write("Check if with participant." + param + " = " + value + " exists");
		for (var i = 0; i < participants.length; i++) {
			if (participants[i][param] == value && participants[i].connected != true) {
				participants[i].connected = true;
				return participants[i].id;
			}
		}
		return false;
	}

	// Set connected = false if participant has left the conference
	this.participantLeft = function (id) {
		for (var i = 0; i < participants.length; i++) {
			if (participants[i].id == id) {
				participants[i].connected = false;
			}
		}
	}

	// Process all calls with waiting status
	this.processWaitingCalls = function () {
		for (var i = 0; i < calls.length; i++) {
			if (calls[i].state == 'waiting') {
				calls[i].state = 'in_process';
				this.processIncomingCall(calls[i].call);
			}
		}
	}

	// Call all participants with auto_call = 1
	this.makeOutboundCalls = function (pId) {
		for (var i in participants) {
			if ((participants[i].auto_call == "1" && typeof pId == 'undefined') ||
				pId == participants[i].id) {
				var call = VoxEngine.callPSTN(participants[i].phone, number);
				this.addConfCall({
					call_id: call.id(),
					call: call,
					input: '',
					state: 'in_process',
					participant_id: participants[i].id
				});
				Logger.write(JSON.stringify(calls));
				this.processOutboundCall(call);
			}
		}
	}

	// Get particular call from calls array
	this.getConfCall = function (call) {
		for (var i in calls) {
			if (calls[i].call == call) return calls[i];
		}
	}

	// Add call to calls array
	this.addConfCall = function (call_obj) {
		calls.push(call_obj);
	}

	// Process successful outbound call
	this.handleOutboundCallConnected = function (e) {
		// Update call obj in calls array
		var cCall = this.getConfCall(e.call);
		cCall.state = 'connected';
		// Connect call audio to the conference audio
		VoxEngine.sendMediaBetween(e.call, conf);
		// Play beep into the conference to notify about new participant
		var snd = VoxEngine.createURLPlayer(BEEP_URL);
		snd.sendMediaTo(conf);
		snd.addEventListener(PlayerEvents.PlaybackFinished, function (ee) {
			// Alone in the conference - play music
			this.ambientMusic();
		}.bind(this));
	}

	// Handle successful incoming call
	this.handleCallConnected = function (e) {
		// Stop playback
		e.call.stopPlayback();
		// Enable DTMF input handling
		e.call.handleTones(true);
		// Second authorization phase (passcode check)
		this.authStep2(e.call);
	}

	// Play message about passcode if there is no input again
	this.handleIntroPlayedStage2 = function (e) {
		e.call.removeEventListener(CallEvents.PlaybackFinished, this.handleIntroPlayedStage2);
		t2 = setTimeout(function () {
			e.call.say("Please specify your passcode, followed by " +
				"the pound sign to join the conference.", Language.UK_ENGLISH_FEMALE);
			e.call.addEventListener(CallEvents.PlaybackFinished, this.handleIntroPlayedStage2);
		}.bind(this), 5000);
	}

	// Handle keypad input
	this.handleToneReceivedStage2 = function (e) {
		clearTimeout(t2);
		e.call.removeEventListener(CallEvents.PlaybackFinished, this.handleIntroPlayedStage2);
		e.call.stopPlayback();
		var cCall = this.getConfCall(e.call);
		// Check passcode if # was pressed
		if (e.tone == "#") {
			Logger.write("Checking passcode: " + cCall.input);
			participant_id = this.participantExists(cCall.input);
			if (participant_id != false) {
				// Found participant with the specified passcode
				cCall.input = "";
				cCall.state = "connected";
				cCall.participant_id = participant_id;
				e.call.removeEventListener(CallEvents.ToneReceived, this.handleToneReceivedStage2);
				Logger.write("Participant id " + participant_id + " has joined the conf");
				// Connect to the conference
				this.joinConf(e.call);
			} else {
				// Could't find the participant with the specified passcode - try again
				cCall.input = "";
				e.call.say("Sorry, wrong passcode was specified, please try again.", Language.UK_ENGLISH_FEMALE);
				e.call.addEventListener(CallEvents.PlaybackFinished, this.handleIntroPlayedStage2);
			}
		} else cCall.input += e.tone; // just add digit to the input till # entered
	}

	// Connect the call to the conference
	this.joinConf = function (call) {
		call.say("You have joined the conference.", Language.UK_ENGLISH_FEMALE);
		call.addEventListener(CallEvents.PlaybackFinished, function (e) {
			// Connect audio
			VoxEngine.sendMediaBetween(call, conf);
			// Play notification sound
			var snd = VoxEngine.createURLPlayer(BEEP_URL);
			snd.sendMediaTo(conf);
			snd.addEventListener(PlayerEvents.PlaybackFinished, function (ee) {
				// If alone in the conference - play music
				this.ambientMusic();
			}.bind(this));
		}.bind(this));
	}

	// Enable / disable ambient music
	this.ambientMusic = function () {
		var p_num = 0;
		for (var i in calls) {
			if (calls[i].state == 'connected') p_num++;
		}	
		if (p_num == 1) {
			// 1 participant - playing music
			music = VoxEngine.createURLPlayer(MUSIC_URL, true);
			music.sendMediaTo(conf);
		} else {
			// 2+ participants - stop playing music
			music.stopMediaTo(conf);
		}
	}

	// Check participant passcode
	this.passcodeCheck = function (call) {
		call.say("Thank you! Please specify your passcode, followed by " +
			"the pound sign to join the conference.", Language.UK_ENGLISH_FEMALE);
		this.handleToneReceivedStage2 = this.handleToneReceivedStage2.bind(this);
		call.addEventListener(CallEvents.ToneReceived, this.handleToneReceivedStage2);
		this.handleIntroPlayedStage2 = this.handleIntroPlayedStage2.bind(this);
		call.addEventListener(CallEvents.PlaybackFinished, this.handleIntroPlayedStage2);
	}

	// Authorization (step 2) depending on the conference settings
	this.authStep2 = function (call) {
		if (anonymousAccess) {
			// Anonymous access allowed - just connect to the conference
			this.joinConf(call);
			this.getConfCall(call).participant_id = null;
		} else {
			if (calleridAuth) {
				// Check caller id
				var participant_id = this.participantWithParamExists("phone", call.callerid());
				if (participant_id != false) {
					// Is ok - join to the conference
					this.joinConf(call);
					this.getConfCall(call).participant_id = participant_id;
				} else {
					// Couldn't find participant with specified caller id - let enter passcode for authorization
					this.passcodeCheck(call);
				}
			} else {
				// Enter passcode check procedure
				this.passcodeCheck(call);
			}
		}
	}

};