var call, // Incoming call var
    input = '', // DTMF input storage
    WEBSERVICE_URL = "path/to/shim.php", // Link to webservice
    INTRO_MUSIC_URL = "path/to/music.mp3", // Link to music mp3
    t1,
    sessionCookie = null; // session id for communication with webservice (shim.php) after successful auth

/**
 *  Process incoming call
 */
VoxEngine.addEventListener(AppEvents.CallAlerting, function (e) {
    call = e.call;
    // Play music during authorization
    call.startEarlyMedia();
    call.startPlayback(INTRO_MUSIC_URL, true);
    // Add event listeners
    call.addEventListener(CallEvents.Connected, handleCallConnected);
    call.addEventListener(CallEvents.Disconnected, function (e) {
        VoxEngine.terminate();
    });
    call.addEventListener(CallEvents.Failed, function (e) {
        VoxEngine.terminate();
    });
    call.addEventListener(CallEvents.ToneReceived, handleToneReceived);
    // Authorization on webservice (shim.php)
    var opts = new Net.HttpRequestOptions();
    opts.method = "GET";
    opts.headers = ["User-Agent: VoxImplant"];
    // Username and password (stored in DB)
    var authInfo = {
        username: "username",
        password: "password"
    };
    Net.httpRequest(WEBSERVICE_URL + "?action=authorize¶ms=" + encodeURIComponent(JSON.stringify(authInfo)), authResult, opts);
});

function authResult(e) {
    // HTTP 200 , successful request
    if (e.code == 200) {
        // Find session id in response headers
        for (var i in e.headers) {
            if (e.headers[i].key == "Set-Cookie") {
                sessionCookie = e.headers[i].value;
                sessionCookie = sessionCookie.substr(0, sessionCookie.indexOf(';'));
            }
        }
        // If something went wrong - terminate session (option: say something to the caller)
        if (sessionCookie == null) {
            Logger.write("No session header found.");
            VoxEngine.terminate();
        }

        Logger.write("Auth Result: " + e.text + " Session Cookie: " + sessionCookie);
        // If auth was OK ship.php should return AUTHORIZED text
        if (JSON.parse(e.text).result == "AUTHORIZED") {
            // Enable DTMF input handling
            call.handleTones(true);
            // Answer on the call - CallEvents.CallConnected event will be fired
            call.answer();
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
 * Handle Call connected
 */
function handleCallConnected(e) {
    // Stop playing music
    call.stopPlayback();
    // Play prompt using TTS and waiting for the caller input (see CallEvents.ToneReceived)
    call.say("Hello! Welcome to VoxImplant conferencing, please enter your conference access code, " +
        "followed by the pound sign", Language.UK_ENGLISH_FEMALE);
    // TTS playback finish handler
    call.addEventListener(CallEvents.PlaybackFinished, handleIntroPlayed);
}

/**
 * Handle TTS playback finished
 */
function handleIntroPlayed(e) {
    // Remove listener
    call.removeEventListener(CallEvents.PlaybackFinished, handleIntroPlayed);
    // Play message again in 5 seconds
    t1 = setTimeout(function () {
        call.say("Please enter your conference access code, " +
            "followed by the pound sign", Language.UK_ENGLISH_FEMALE);
        call.addEventListener(CallEvents.PlaybackFinished, handleIntroPlayed);
    }, 5000);
}

/**
 * Handle keypad input (DTMF)
 */
function handleToneReceived(e) {
    clearTimeout(t1);
    call.removeEventListener(CallEvents.PlaybackFinished, handleIntroPlayed);
    call.stopPlayback();
    // Check the access code if pound was entered
    if (e.tone == '#') {
        var opts = new Net.HttpRequestOptions();
        opts.method = "GET";
        opts.headers = ["Cookie: " + sessionCookie];
        // Data for webservice - access code and conference phone number
        var requestInfo = {
            access_number: call.number().replace(/[\s\+]+/g, ''),
            access_code: input
        };
        Net.httpRequest(WEBSERVICE_URL + "?action=get_conference¶ms=" + encodeURIComponent(JSON.stringify(requestInfo)), getConferenceResult, opts);
    } else input += e.tone;
}

/**
 * Handle get_conference request result
 */
function getConferenceResult(e) {
    if (e.code == 200) {
        var result = JSON.parse(e.text);
        if (typeof result.result != "undefined") {
            // Have conference id
            result = result.result;
            // Disable input processing before sending the call to conference server
            call.removeEventListener(CallEvents.ToneReceived, handleToneReceived);
            call.handleTones(false);
            input = ''; 
            Logger.write('Joining conference conf' + result.conference_id);
            // Forward call to conference with name conf + conference id and pass callerid
            var conf = VoxEngine.callConference('conf' + result.conference_id, call.callerid());
            VoxEngine.easyProcess(call, conf);
        } else {
            input = '';
            call.say("Sorry, there is no conference with entered access code, please try again.", Language.UK_ENGLISH_FEMALE);
            call.addEventListener(CallEvents.PlaybackFinished, handleIntroPlayed);
        }
    } else {
        Logger.write("GetConference HTTP request failed: " + e.code);
        input = '';
        call.say("Sorry, there is no conference with entered access code, please try again.", Language.UK_ENGLISH_FEMALE);
        call.addEventListener(CallEvents.PlaybackFinished, handleIntroPlayed);
    }
}