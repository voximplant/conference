<?php
/**
*	Parse HTTP request headers
*/
function parseRequestHeaders() {
    $headers = array();
    foreach($_SERVER as $key => $value) {
        if (substr($key, 0, 5) <> 'HTTP_') {
            continue;
        }
        $header = str_replace(' ', '-', ucwords(str_replace('_', ' ', strtolower(substr($key, 5)))));
        $headers[$header] = $value;
    }
    return $headers;
}
$headers = parseRequestHeaders();
/**
*	If User-Agent header has VoxImplant value then create new session
*	and return session id in Set-Cookie header
*/
if (isset($headers['User-Agent'])) {
	session_start();
	if ($headers['User-Agent'] == "VoxImplant") header("Set-Cookie: PHPSESSID=".session_id()."; path=/");
} else session_start();

/**
* Database Interface and Web Services for Conference
*/
include("OBJ-MySQL/OBJ_mysql.php");
/**
* Use PHPMailer for sending notification emails via SMTP
*/
require 'PHPMailer/class.smtp.php';
require 'PHPMailer/class.phpmailer.php';


// MySQL DB connection configuration
$config = array();
$config["hostname"]  = "127.0.0.1";
$config["database"]  = "voxconf";
$config["username"]  = "root";
$config["password"]  = "";

/**
*	VoxImplant HTTP API access settings
*/
define("API_URL", "https://api.voximplant.com/platform_api/");
define("API_KEY", "YOUR VOXIMPLANT API_KEY");
define("ACCOUNT_NAME", "YOUR VOXIMPLANT ACCOUNT_NAME");
define("RULE_ID", "YOUR APPLICATION RULE_ID"); // Rule which starts conference via HTTP request

//other configurations
/*$config["port"]      = "PORT"; //defaults to 3306
$config["charset"]    = "CHARSET"; //defaults to UTF-8
$config["exit_on_error"] = "TRUE|FALSE"; //defaults to true
$config["allow_logging"] = "TRUE|FALSE"; //defaults to true*/

function sendEmail($name, $email, $passcode, $conference) {

	$mail = new PHPMailer;
	// Specify your SMTP server settings below
	$mail->isSMTP();                                      
	$mail->Host = 'smtp.server.com';
	$mail->SMTPAuth = true;                               
	$mail->Username = 'smtp_username';                 
	$mail->Password = 'smtp_password';                          
	$mail->SMTPSecure = 'tls';                           
	$mail->Port = 587;

	$mail->From = 'no-reply@mydomain.com';
	$mail->FromName = 'VoxImplant Conference';
	$mail->addAddress($email, $name);

	$mail->WordWrap = 50;
	$mail->isHTML(true);

	$mail->Subject = 'VoxImplant Conference Info';
	$mail->Body    = 'Please find conference info below:<br/>'.
					 'Conference access number ' . $conference['access_number'] . '<br/>' .
					 'Access code ' . $conference['access_code'] . '<br/>' . 
					 'Passcode ' . $passcode . '<br/>';

	$mail->AltBody = 'Please find conference info below:\r\n'.
					 'Conference access number ' . $conference['access_number'] . '\r\n' .
					 'Access code ' . $conference['access_code'] . '\r\n' . 
					 'Passcode '. $passcode . '\r\n';

	if(!$mail->send()) {
	    //echo 'Message could not be sent.';
	    //echo 'Mailer Error: ' . $mail->ErrorInfo;
	} else {
	    //echo 'Message has been sent';
	}

}

function httpRequest($url, $params = null) {
	$ch = curl_init();
	curl_setopt($ch, CURLOPT_URL, $url);	
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);
	$server_output = curl_exec ($ch);
	curl_close ($ch);
	return $server_output;
}

function terminate($msg, $bypass = false) {
	if ($bypass) die($msg);
	else {
		$result = json_encode(array("error" => $msg));
		die($result);
	}
}

function printResult($result) {
	$result = json_encode(array("result" => $result));
	exit($result);
}

function generateAccessCode($length = 5) {
	$characters = '0123456789';
    $randomString = '';
    for ($i = 0; $i < $length; $i++) {
        $randomString .= $characters[rand(0, strlen($characters) - 1)];
    }
    return $randomString;
}

function checkAccessCode($access_number, $access_code, $db) {
	// check if no other conferences with the same access_code exists
	$Result = $db->query("SELECT * FROM conferences WHERE access_number = ? AND access_code = ? AND active = ?", array($access_number, $access_code, 1));
	$Confs  = $Result->fetchALL();
	if (sizeof($Confs) > 0) return true;
	else return false;
}

function checkPasscode($conference_id, $passcode, $db) {
	// check if no other conferences with the same access_code exists
	$Result = $db->query("SELECT * FROM participants WHERE conference_id = ? AND passcode = ?", array($conference_id, $passcode));
	$Parts  = $Result->fetchALL();
	if (sizeof($Parts) > 0) return true;
	else return false;
}

$action_types = array(
	'authorize',
	'create_conference',
	'delete_conference', 
	'add_participant',
	'edit_participant',
	'remove_participant',
	'get_participants',
	'get_numbers',
	'get_access_code',
	'start_conference',
	'get_conference_info',
	'get_conference',
	'save_ms_url',
	'mute_participant',
	'unmute_participant',
	'disconnect_participant',
	'redial_participant'
);

if (isset($_REQUEST['action'])) {

	$action = $_REQUEST['action'];
	if (!in_array($action, $action_types)) {
		terminate("Unknown action type specified");
	}

	$db = new OBJ_mysql($config);
	if (isset($_REQUEST['params'])) $_REQUEST['params'] = stripslashes($_REQUEST['params']);
	if ($action != 'authorize') {
		if (!isset($_SESSION['manager_id'])) terminate("Unauthorized");	
	}
	if ($action != 'get_numbers') {
		if (!isset($_REQUEST['params'])) terminate("Params not specified");
		else $data = json_decode($_REQUEST['params'], true);
	}

	switch ($action) {
		case 'authorize':

			if (isset($_SESSION['ms_url'])) unset($_SESSION['ms_url']);
			
			$required_params = array(
				'username',
				'password'
			);

			if(count(array_intersect_key(array_flip($required_params), $data)) === count($required_params)) {								
				$Result = $db->query("SELECT * FROM managers WHERE username = ? AND password = ? AND active = ?", array($data['username'], sha1($data['password']), 1));
				$Managers  = $Result->fetchALL();
				if (sizeof($Managers) > 0) {				
					// CLEAR OLD CONFERENCES
					$db->query("DELETE FROM conferences WHERE created < UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 30 DAY))");	
					// RETURN AUTH RESULT
					$_SESSION['manager_id']=$Managers[0]->id;
					printResult('AUTHORIZED');
				} else terminate("Wrong username or password");
			} else terminate("Required params not specified");


		break;
		case 'create_conference':

			$required_params = array(
				'access_number',
				'anonymous_access',
				'callerid_auth'
			);

			if(count(array_intersect_key(array_flip($required_params), $data)) === count($required_params)) { 

				$result = true;
				while ($result) {
					$access_code = generateAccessCode();
					$result = checkAccessCode($data['access_number'], $access_code, $db);
				}
				$data['access_code'] = $access_code;
				$data['active'] = false;
				if ($data['anonymous_access']) $data['active'] = true;
				$data['manager_id'] = $_SESSION['manager_id'];

				$new_conference_id = $db->insert('conferences', $data);
				if ($new_conference_id) {
					printResult(array("id" => $new_conference_id, "access_code" => $access_code));	
				} else terminate("Couldn't create the conference");
			} else terminate("Required params not specified");

			break;

		case 'get_access_code':

			$required_params = array(
				'access_number'
			);

			if(count(array_intersect_key(array_flip($required_params), $data)) === count($required_params)) { 
				$result = true;
				while ($result) {
					$access_code = generateAccessCode();
					$result = checkAccessCode($data['access_number'], $access_code, $db);
				}
				printResult($access_code);
			} else terminate("Required params not specified");

			break;

		case 'delete_conference':

			$required_params = array(
				'conference_id'
			);

			if(count(array_intersect_key(array_flip($required_params), $data)) === count($required_params)) { 
				$ok = $db->update('conferences', array('active' => 0), array('id' => $data['conference_id']));
				if ($ok) printResult(true);
				else terminate("Couldn't delete conference");
			} else terminate("Required params not specified");

			break;

		case 'start_conference':

			$required_params = array(
				'conference_id',
				'auto_call',
				'send_emails'
			);

			if(count(array_intersect_key(array_flip($required_params), $data)) === count($required_params)) {

				if ($data['send_emails'] == "true") {
					$Result = $db->query("SELECT * FROM conferences WHERE id = ?", array($data['conference_id']));
					$Conferences  = $Result->fetchALL();
					if (sizeof($Conferences) > 0) {	

						$access_number = $Conferences[0]->access_number;
						$access_code = $Conferences[0]->access_code;	

						// Check all participants with specified email address and send them conference info
						$Result = $db->query("SELECT * FROM participants WHERE conference_id = ? AND email IS NOT NULL AND email <> ''  AND auto_call = 0", array($data['conference_id']));
						$Participants  = $Result->fetchALL();
						if (sizeof($Participants) > 0) {
							foreach ($Participants as $participant) {
								// Uncomment for to send emails to participants
								// sendEmail($participant->name, $participant->email, $participant->passcode, array('access_number' => $access_number, 'access_code' => $access_code ));
							}
						}

					} else terminate("No conference found");					
				} 

				// START CONFERENCE VIA HTTP API 
				if ($data['auto_call'] == "true") {
					$url = API_URL . "StartConference/?" .
							"account_name=" . ACCOUNT_NAME . 
							"&api_key=" . API_KEY .
							"&rule_id=" . RULE_ID .
							"&conference_name=conf" . $data['conference_id'] .
							"&script_custom_data=" . urlencode(json_encode(array('conference_id' => $data['conference_id'], 'start_type' => 'http')));

					$params = array();
					$result = httpRequest($url, $params);
					$res_obj = json_decode($result);
					if (isset($res_obj->error)) terminate($result, true);
					else {
						if ($res_obj->result) $ms_url = $res_obj->media_session_access_url;
						$ok = $db->update('conferences', array('active' => 1, 'ms_url' => $ms_url), array('id' => $data['conference_id']));
						if ($ok) {
							$_SESSION['ms_url'] = $ms_url;
							printResult(true);
						}
					}
				} else {
					$ok = $db->update('conferences', array('active' => 1), array('id' => $data['conference_id']));
					if ($ok) printResult(true);
					else terminate("Couldnt start the conference");
				}

			} else terminate("Required params not specified");

			break;

		case 'save_ms_url': 

			$required_params = array(
				'conference_id',
				'ms_url'
			);

			if(count(array_intersect_key(array_flip($required_params), $data)) === count($required_params)) { 

				$ok = $db->update('conferences', array('ms_url' => $data['ms_url']), array('id' => $data['conference_id']));
				if ($ok) {
					printResult(true);
				} else terminate(false);

			} else terminate("Required params not specified");

		break;

		case 'get_conference_info':

			if (!isset($_SESSION['ms_url'])) {

				$required_params = array(
					'conference_id'
				);

				if(count(array_intersect_key(array_flip($required_params), $data)) === count($required_params)) {

					$Result = $db->query("SELECT * FROM conferences WHERE id = ? AND active = ?", array($data['conference_id'], 1));
					$Conferences  = $Result->fetchALL();
					if (sizeof($Conferences) > 0) {					
						if ($Conferences[0]->ms_url != '') $_SESSION['ms_url']=$Conferences[0]->ms_url;
						else terminate("No media session exists[DB]");
					} else terminate("No conference found");

				} else terminate("Required params not specified");				
			}

			$url = $_SESSION['ms_url'] . "/command=gather_info";
			$params = array();
			$result = httpRequest($url, $params);
			if ($result != FALSE) printResult($result);
			else {
				if (isset($_SESSION['ms_url'])) unset($_SESSION['ms_url']);
				terminate("No media session exists [MS]");
			}

		break;

		case 'mute_participant':

			$required_params = array(
				'conference_id',
				'participant_id'
			);

			if(count(array_intersect_key(array_flip($required_params), $data)) === count($required_params)) {
				$url = $_SESSION['ms_url'] . "/command=mute_participant/pId=" . $data['participant_id'];
				$params = array();
				$result = httpRequest($url, $params);
				printResult($result);
			} else terminate("Required params not specified");

		break;

		case 'unmute_participant':

			$required_params = array(
				'conference_id',
				'participant_id'
			);

			if(count(array_intersect_key(array_flip($required_params), $data)) === count($required_params)) {
				$url = $_SESSION['ms_url'] . "/command=unmute_participant/pId=" . $data['participant_id'];
				$params = array();
				$result = httpRequest($url, $params);
				printResult($result);
			} else terminate("Required params not specified");

		break;

		case 'disconnect_participant':

			$required_params = array(
				'conference_id',
				'participant_id'
			);

			if(count(array_intersect_key(array_flip($required_params), $data)) === count($required_params)) {
				$url = $_SESSION['ms_url'] . "/command=disconnect_participant/pId=" . $data['participant_id'];
				$params = array();
				$result = httpRequest($url, $params);
				printResult($result);
			} else terminate("Required params not specified");

		break;

		case 'redial_participant':

			$required_params = array(
				'conference_id',
				'participant_id'
			);

			if(count(array_intersect_key(array_flip($required_params), $data)) === count($required_params)) {
				$url = $_SESSION['ms_url'] . "/command=redial_participant/pId=" . $data['participant_id'];
				$params = array();
				$result = httpRequest($url, $params);
				if ($result != FALSE) printResult($result);
				else {
					$url = API_URL . "StartConference/?" .
							"account_name=" . ACCOUNT_NAME . 
							"&api_key=" . API_KEY .
							"&rule_id=" . RULE_ID .
							"&conference_name=conf" . $data['conference_id'] .
							"&script_custom_data=" . urlencode(json_encode(array('conference_id' => $data['conference_id'], 'start_type' => 'http', 'event' => 'redial', 'pId' => $data['participant_id'])));

					$params = array();
					$result = httpRequest($url, $params);
					$res_obj = json_decode($result);
					if (isset($res_obj->error)) terminate($result, true);
					else {
						if ($res_obj->result) $ms_url = $res_obj->media_session_access_url;
						$ok = $db->update('conferences', array('active' => 1, 'ms_url' => $ms_url), array('id' => $data['conference_id']));
						if ($ok) {
							$_SESSION['ms_url'] = $ms_url;
							printResult(true);
						}
					}
				}
			} else terminate("Required params not specified");

		break;

		case 'get_conference':

			$required_params = array(
				'access_number',
				'access_code'
			);

			if(count(array_intersect_key(array_flip($required_params), $data)) === count($required_params)) { 
				
				$Result = $db->query("SELECT * FROM conferences WHERE access_code = ? AND access_number = ? AND active = ?", array($data['access_code'], $data['access_number'], 1));
				$Conferences  = $Result->fetchALL();
				if (sizeof($Conferences) > 0) {					
					printResult(array('conference_id' => $Conferences[0]->id));
				} else terminate("No conference with specified access code exists");

			} else terminate("Required params not specified");

		break;

		case 'add_participant':

			$required_params = array(
				'conference_id',
				'name',
				'number',
				'email',
				'auto_call'
			);

			if(count(array_intersect_key(array_flip($required_params), $data)) === count($required_params)) { 

				$result = true;
				while ($result) {
					$passcode = generateAccessCode();
					$result = checkPasscode($data['conference_id'], $passcode, $db);
				}

				$participant_id = $db->insert('participants', array(
								'conference_id' => $data['conference_id'],
                                'name'  => $data['name'],
                                'email' => $data['email'],
                                'phone' => $data['number'],
                                'auto_call' => $data['auto_call'],
                                'passcode' => $passcode 
                              )
                          );

				if ($participant_id) {
					if (isset($data['online'])) {
						
						if (!isset($_SESSION['ms_url'])) {
							$result = FALSE;
						} else {
							$url = $_SESSION['ms_url'] . "/command=redial_participant/pId=" . $participant_id . "/options=reload_participants";
							$params = array();
							$result = httpRequest($url, $params);	
						}
						
						if ($result != FALSE) printResult(array("id" => $participant_id, "passcode" => $passcode));
						else {
							$url = API_URL . "StartConference/?" .
									"account_name=" . ACCOUNT_NAME . 
									"&api_key=" . API_KEY .
									"&rule_id=" . RULE_ID .
									"&conference_name=conf" . $data['conference_id'] .
									"&script_custom_data=" . urlencode(json_encode(array('conference_id' => $data['conference_id'], 'start_type' => 'http', 'event' => 'redial', 'pId' => $participant_id)));

							$params = array();
							$result = httpRequest($url, $params);
							$res_obj = json_decode($result);
							if (isset($res_obj->error)) terminate($result, true);
							else {
								if ($res_obj->result) $ms_url = $res_obj->media_session_access_url;
								$ok = $db->update('conferences', array('active' => 1, 'ms_url' => $ms_url), array('id' => $data['conference_id']));
								if ($ok) {
									$_SESSION['ms_url'] = $ms_url;
									printResult(array("id" => $participant_id, "passcode" => $passcode));
								}
							}
						}

					} else printResult(array("id" => $participant_id, "passcode" => $passcode));				
				} else terminate("Couldn't add participant");
				
			} else terminate("Required params not specified");

			break;

		case 'edit_participant':

			$required_params = array(
				'participant_id',
				'conference_id',
				'param',
				'value'
			);

			if ($data['param'] != "name" && 
				$data['param'] != "number" && 
				$data['param'] != "auto_call" &&
				$data['param'] != "email") {
				terminate("Specified param not allowed");
			}
			if ($data['param'] == "number") $param = "phone";
			else $param = $data['param'];

			if(count(array_intersect_key(array_flip($required_params), $data)) === count($required_params)) { 
				$ok = $db->update('participants', array($param => $data['value']), array('id' => $data['participant_id'], 'conference_id' => $data['conference_id']));
				if ($ok) printResult(array(
					"id" => $data['participant_id'],
					"param" => $data['param'],
					"value" => $data['value']
					));
				else terminate("Couldn't delete conference");
			} else terminate("Required params not specified");

			break;

		case 'remove_participant':

			$required_params = array(
				'participant_id',
				'conference_id'
			);

			if(count(array_intersect_key(array_flip($required_params), $data)) === count($required_params)) { 

				$ok = $db->delete('participants', array('id' => $data['participant_id'], 'conference_id' => $data['conference_id']));

				if ($ok) printResult(array("id" => $data['participant_id'], "status" => "DELETED"));
				else terminate("Couldn't remove participant");
				
			} else terminate("Required params not specified");

			break;

		case 'get_numbers':

			$url = API_URL . "GetPhoneNumbers/?" .
			"account_name=" . ACCOUNT_NAME . 
			"&api_key=" . API_KEY;

			$params = array();
			$phone_numbers = array();
			$result = httpRequest($url, $params);
			$res_obj = json_decode($result);
			foreach ($res_obj->result as $i=>$val) {
				if (isset($val->application_name)) {
					if ($val->application_name == "conference.aylarov.voximplant.com") $phone_numbers[] = array("id" => $val->phone_id, "number" => $val->phone_number);
				}
			}
			if (isset($res_obj->error)) terminate($result, true);
			else printResult($phone_numbers);

			break;

		case 'get_participants':

			$required_params = array(
				'conference_id'
			);

			if(count(array_intersect_key(array_flip($required_params), $data)) === count($required_params)) { 
				
				$Result = $db->query("SELECT * FROM conferences WHERE id = ? AND manager_id = ?", array($data['conference_id'], $_SESSION['manager_id'])); 
				$Conferences  = $Result->fetchALL();
				if (sizeof($Conferences) > 0) {					
					
					$Result = $db->query("SELECT * FROM participants WHERE conference_id = ?", array($data['conference_id']));
					$Participants  = $Result->fetchALL();
					printResult(array("participants" => $Participants, "conference" => $Conferences[0]));

				} else terminate("No conference found");
			} else terminate("Required params not specified");
		
			break;

		default:
			# code...
			break;
	}
} else {
	terminate("No action type specified");
}
?>