Audio conferencing service
=========

![Conference Manager Interface](http://habrastorage.org/files/71e/3e7/25a/71e3e725a3b94a0781118b712c0892d1.png "Conference Manager")

This project contains [VoxEngine] scenarios, webservice (PHP), DB schema (MySQL) and web interface for conference management. This README file describes how to use the provided files to build audio conferencing service. The only thing you need to start building your audio conferencing is VoxImplant developer account - you can get it for free at https://voximplant.com/sign-up

Quickstart
----
### Webservice Installation
Use `voximplant.sql` from DB_schema to create database structure, in addition to the structure there will be one user admin/admin created in the managers table. 

Upload files from Webservice folder on your web server (with PHP support) and change database connection settings in `shim.php` file:

    // MySQL DB connection configuration
    `$config = array();
    $config["hostname"]  = "127.0.0.1";
    $config["database"]  = "voxconf";
    $config["username"]  = "root";
    $config["password"]  = "";
    
And specify your VoxImplant API access settings (you can get this info at https://manage.voximplant.com/#apiaccess and rule id will be generated automatically later - see VoxImplant Setup):

    /**
    *   VoxImplant HTTP API access settings
    */
    define("API_URL", "https://api.voximplant.com/platform_api/");
    define("API_KEY", "YOUR VOXIMPLANT API_KEY");
    define("ACCOUNT_NAME", "YOUR VOXIMPLANT ACCOUNT_NAME");
    define("RULE_ID", "YOUR APPLICATION RULE_ID"); // Rule which starts conference via HTTP request

You can also specify your SMTP server info in **sendEmail** function if you plan to send email notifications with conference access info to participants and uncomment this string to enable this functionality:

    // sendEmail($participant->name, $participant->email, $participant->passcode, array('access_number' => $access_number, 'access_code' => $access_code ));



### Manager Inteface Setup
Upload Manager folder on your web server (with PHP support) and change `window.WEBSERVICE_URL` in **index.php** to real path to your shim.php on a web server.

    // SPECIFY PATH TO shim.php ON YOUR WEBSERVER
    window.WEBSERVICE_URL = "path/to/shim.php"; 

### VoxImplant Setup
After you successfully created and activated your VoxImplant developer account you need to login into VoxImplant admin interface and complete these steps to setup conferencing service:
- Buy phone number in VoxImplant Control Panel at https://manage.voximplant.com/#numbers
- Create 3 new scenarios using the files from VoxEngine folder of the project (ConferenceGatekeeper.js, StandaloneConference.js, VoxConference.js) at https://manage.voximplant.com/#scenarios , **Warning: don't forget to change WEBSERVICE_URL, BEEP_URL, MUSIC_URL to real URLs**
- Create new VoxImplant application called `conference` at https://manage.voximplant.com/#applications, its full name will look like `conference.youraccountname.voximplant.com`
- Specify rules for the application, they will be used to launch the scenarios using [HTTP API] or after the incoming call reaches the platform. Overall 3 rules are required:

    1. Name: **IncomingCall**, Pattern: VoxImplant phone number bought in VoxImplant Control Panel (i.e. `18001231213`), Assigned scenario: ConferenceGatekeeper. It will handle incoming calls to phone number connected to the application and first part of the authorization process (access code check).
    2. Name: **FwdToConf**, Pattern: `conf`, Assigned scenarios: `VoxConference`, `StandaloneConference` (in this order)
    3. Name: **StartConfHTTP**, Pattern: `.*`, Assigned scenarious: `VoxConference`, `StandaloneConference` (in this order)
    
    
- Connect phone number(s) your've bought before to the application at https://manage.voximplant.com/#mynumbers
    
### Creating conference
Open Manager interface in your browser and log in using admin/admin login/passowrd pair. If everything was done correctly you should see the conference settings including the dropdown list with the phone number(s) you've bought and connected to your VoxImplant conference application:
![Conference access settings](http://habrastorage.org/files/765/503/bb7/765503bb79d247319d6fc6f08f97162d.png "Access Settings")

Version
----
1.0

[VoxImplant]:http://voximplant.com
[VoxEngine]:http://voximplant.com/help/faq/what-is-voxengine/
[HTTP API]:http://voximplant.com/docs/references/httpapi/
[StartScenarios]:http://voximplant.com/docs/references/httpapi/StartScenarios.html