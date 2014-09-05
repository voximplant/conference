<?php
// Uncomment for security purposes
/*
if ($_SERVER["SERVER_PORT"] != 443) {
    $redir = "Location: https://" . $_SERVER['HTTP_HOST'] . $_SERVER['PHP_SELF'];
    header($redir);
    exit();
}
*/
?>
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>VoxImplant Conferencing</title>
	<meta name="description" content="VoxImplant Conferencing App">
	<meta name="author" content="Zingaya Inc.">

	<!-- Latest compiled and minified CSS -->
	<link rel="stylesheet" href="//netdna.bootstrapcdn.com/bootstrap/3.1.1/css/bootstrap.min.css">
	<link href="//cdnjs.cloudflare.com/ajax/libs/x-editable/1.5.0/bootstrap3-editable/css/bootstrap-editable.css" rel="stylesheet"/>

    <script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.min.js"></script>

	<!-- Latest compiled and minified JavaScript -->
	<script src="//netdna.bootstrapcdn.com/bootstrap/3.1.1/js/bootstrap.min.js"></script>
	<script src="//cdnjs.cloudflare.com/ajax/libs/x-editable/1.5.0/bootstrap3-editable/js/bootstrap-editable.min.js"></script>
	
	<!-- HTML5 Shim and Respond.js IE8 support of HTML5 elements and media queries -->
    <!-- WARNING: Respond.js doesn't work if you view the page via file:// -->
    <!--[if lt IE 9]>
		<script src="js/lib/es5-shim.min.js"></script>
      	<script src="js/lib/es5-sham.min.js"></script>
      	<script src="js/lib/html5shiv.js"></script>
      	<script src="js/lib/respond.min.js"></script>
    <![endif]-->
    <link rel="stylesheet" href="css/app.css">
    <script>
    	// SPECIFY PATH TO shim.php ON YOUR WEBSERVER
    	window.WEBSERVICE_URL = "path/to/shim.php"; 
    </script>
</head>
<body>

	<div class="container" style="margin-top: 50px">
		<div class="panel panel-default">
			<div class="panel-heading">
		    	<h3 class="panel-title" id="panelTitle">VoxImplant Conferencing</h3>
		  	</div>
  		  	<div class="panel-body">
  		  		<div id="vcApp"></div>
			</div>
		</div>
	</div>

	<script src="js/bundle.min.js"></script>
	</body>
</html>
