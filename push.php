<!-- Script by: Riajul Islam 
     Available from: https://stackoverflow.com/questions/42989007/how-to-send-fcm-notification-to-app-from-web
     Altered to pass parameters from front-end :-)
     Can be used to schedule notifications to the user. 
--> 

<?php
    $url = "https://fcm.googleapis.com/fcm/send";
    $token = $_GET['id'];
    $serverKey = 'AIzaSyAF6qCE8Md40VUe_18px69omAZs9fBxNYQ';
    $title = $_GET['title'];
    $body = $_GET['message'];
    $notification = array('title' =>$title , 'body' => $body, 'sound' => 'default', 'badge' => '1');
    $arrayToSend = array('to' => $token, 'notification' => $notification,'priority'=>'high');
    $json = json_encode($arrayToSend);
    $headers = array();
    $headers[] = 'Content-Type: application/json';
    $headers[] = 'Authorization: key='. $serverKey;
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST,"POST");
    curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
    curl_setopt($ch, CURLOPT_HTTPHEADER,$headers);

    //Send the request
    $response = curl_exec($ch);

    //Close request
    if ($response === FALSE) {
    die('FCM Send Error: ' . curl_error($ch));
    }

    curl_close($ch);
?>