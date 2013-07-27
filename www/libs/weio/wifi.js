/**
*
* WEIO Web Of Things Platform
* Copyright (C) 2013 Nodesign.net, Uros PETREVSKI, Drasko DRASKOVIC
* All rights reserved
*
*               ##      ## ######## ####  #######  
*               ##  ##  ## ##        ##  ##     ## 
*               ##  ##  ## ##        ##  ##     ## 
*               ##  ##  ## ######    ##  ##     ## 
*               ##  ##  ## ##        ##  ##     ## 
*               ##  ##  ## ##        ##  ##     ## 
*                ###  ###  ######## ####  #######
*
*                    Web Of Things Platform
*
* WEIO is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* WEIO is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU General Public License for more details.
*
* You should have received a copy of the GNU General Public License
* along with this program.  If not, see <http://www.gnu.org/licenses/>.
* 
* This file is part of WEIO.
*
* Authors : 
* Uros PETREVSKI <uros@nodesign.net>
* Drasko DRASKOVIC <drasko.draskovic@gmail.com>
*
**/


/**
 * Wifi SockJS object, Web socket for scaning and changing wifi parameters
 */
var wifiSocket = new SockJS('http://' + location.host + '/wifi');



/**
 * Wifi Json structure. Interesting keys are : 
 * essid (string), 
 * quality (0-70 integer),
 * opened (true - for networks without security)
 * connected (true if Weio is connected to that network)
 * password (always empty, to be filled by user)
 */

var wifi = 0;
 
/**
 * Weio can be in two modes Acess Point AP and STA mode (client of one wifi network)
 */
var wifiCurrentMode = "sta"; // "sta" or "ap"

/**
 * Wifi network identifier that Weio is currently connected to.
 * We can't distinguish wifis only by their essid because there can be
 * two networks that have same name
 */
var connectedToWifiId = "";
var wifiMode = "";

/* * 
 * Wifi cell object that has been selected to be joined
 * not to confound with connectedToWifiId
 */
var selectedCell = -1;

/**
 * Generates drop down menu for wifi networks
 * first line in drop down menu will be status line that informs
 * user what is happening in network detection
 * for example : Detecting wifi networks...
 * List of wifi networks is shown directely from cache memory
 * At the same time new scan is launched and will update list
 * when he gets new data
 */


function injectWifiNetworksInDropMenu() {
//{"mac": "7656757", "essid": "ddwifi", "quality" : "50/70", "encryption" : "WPA2 PSK (CCMP)", "opened" : True, "connected": False}
    $("#wifiNetworks").empty();

   // $("#wifiNetworks").append('<li class="disabled"><a tabindex="-1" href="#">Scanning networks <i class="icon-spinner icon-spin" id="wifiIcons"></i></a></li>');
   // $("#wifiNetworks").append('<li class="divider"></li>');
    
    $("#wifiNetworks").append('<li><a tabindex="-1" href="#changeWifi" role="button" data-toggle="modal">Connect to another network</a></li>');
    $("#wifiNetworks").append('<li><a tabindex="-1" href="#createWifi" onclick="" role="button" data-toggle="modal" >Create network</a></li>');
    $("#wifiNetworks").append('<li><a tabindex="-1" href="#" onclick="scanWifiNetworks()">Rescan wifi networks</a></li>');
    $("#wifiNetworks").append('<li class="divider"></li>');
    
    for (var cell in wifi) {
        // update current connected object
        if (wifi[cell].connected == true) {
            connectedToWifiId = wifi[cell].mac;
        }

        wifiMode =  wifi[cell].mode;
        
        var secureWifi = (wifi[cell].opened==false) ? '<i class="icon-lock" id="wifiIcons"></i>' : '';

        // detect where is my current network
        var currentConnection = (wifi[cell].mac==connectedToWifiId) ? '<i class="icon-caret-right" id="wifiPrefixIcons"></i>' : '';
        
        // transform wifiQuality object into html
        var wifiQuality = '<img src="img/wifi' + getCellQuality(wifi[cell]) + '.png" id="wifiIcons"></img>';
                
        $("#wifiNetworks").append('<li><a tabindex="-1" onclick="prepareToChangeWifi('+ wifi[cell].mac + ')" role="button" data-toggle="modal">' + currentConnection + wifi[cell].essid  + wifiQuality + secureWifi + '</a></li>');
    }
   
    // don't do it here avoid infinite loop
    // scan wifi networks 
   // scanWifiNetworks();
};


/*
 * Parsing cell quality, returning integer 0-3
 */
function getCellQuality(cell) {
    // parse quality signal, original examples : 4/70, 50/70
    var rawStringQuality = cell.quality;
    var n = rawStringQuality.split("/");
    var wifiQuality = n[0];
     
    //console.log(parseInt(wifiQuality) + " " + cell.quality);
   
    // wifi quality signals are from 0-70, we have icons for total of 4 levels (icons from 0-3). 3/70 = 0.042857142857143
    wifiQuality = Math.round(parseInt(wifiQuality) * 0.042857142857143);
    
    return wifiQuality;
};


/*
 * Ask server to scan wifi networks
 */
function scanWifiNetworks() {
    var scanWifi = { "request": "scan"};
    wifiSocket.send(JSON.stringify(scanWifi));
};

/**
 * Prepare to change Wifi : store selected wifi cell in selectedCell 
 * object then call modal view to confirm. Once confirmed, modal view will
 * call changeWifiNetwork() that will give final instruction to server
 * to change network
*
 */

function prepareToChangeWifi(id) {
    var cell = -1;

    // verify if you are already connected to this network
    if (id != connectedToWifiId) { 
        for (var cell in wifi) {
            if (wifi[cell].mac == id) {
                // gotcha selected cell
                cell = wifi[cell];
                break;
            }
        }
        $("#myModalChangeWifiLabel").html("Join " + cell.essid + " wireless network?");

        // if password is required add password field 
        if (cell.opened==false) {
             $("#wifiPassword").css("display", "block");
        } else {
            $("#wifiPassword").css("display", "none");
        }
        
        // put selected cell into object that will be used
        // in changeWifiNetwork()
        // in the case that modal is confirmed
        selectedCell = cell;

        goSta();

        $("#changeWifi").modal("show");
    }
};

/**
 * Go to AP mode 
 */

function goAp() {
    var essidAPuser = document.getElementById("wifiSSIDAP").value;
    var pass = document.getElementById("wifiPasswordAP").value;
    
    // Checks for strings that are either empty or filled with whitespace
    if((/^\s*$/).test(essidAPuser)) {
        alert("I can't accept empty essid name!");
    } else {
        changeWifi = { "request": "goAp", "data": {"essid": essidAPuser, "password": pass}};
//        console.log(changeWifi);
        wifiSocket.send(JSON.stringify(changeWifi));
        $('#createWifi').modal('hide');
    }
    
};


/**
 * Send back chosen wifi network. Network has been previously chosed
 * by prepareToChange(id) function and stored in selectedCell object
 */

function goSta() {
    var changeWifi = 0;

    if (selectedCell.opened == false) {
        var password = $("#wifiPassword").val();
    
        // Checks for strings that are either empty or filled with whitespace
        if((/^\s*$/).test(password)) { 
            alert("Password field can't be empty!");
        }
    }

    changeWifi = { "request": "goSta", "data" : selectedCell};
    console.log(changeWifi);
    wifiSocket.send(JSON.stringify(changeWifi));
    
    selectedCell = -1; // reset selection
};


//CALLBACKS////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Define callbacks here and request keys
 * Each key is binded to coresponding function
 */
var callbacksWifi = {
    "scan": updateWifiCells,
    "mode": updateWifiMode,
    
};

function updateWifiCells(data) { 
 
   //console.log("gotchaaaa");
   var cellList = data.data;
   
   for (var cell in cellList) {
       if (cellList[cell].connected) {
           $("#connectedWifiName").html('<img src="img/wifi' + getCellQuality(cellList[cell]) + 'b.png" id="wifiIcons"></img>' + cellList[cell].essid);
       }
   }
   wifi = cellList;
   injectWifiNetworksInDropMenu();
  
};

function updateWifiMode(data) {
    wifiMode =  data.mode;
};

//////////////////////////////////////////////////////////////////////////////////////////////////// SOCK JS WIFI        
    
/*
* On opening of wifi web socket ask server to scan wifi networks
*/
wifiSocket.onopen = function() {
    console.log('Wifi Web socket is opened');
    scanWifiNetworks();
};

/*
* Wifi web socket parser, what we got from server
*/
wifiSocket.onmessage = function(e) {
    //console.log('Received: ' + e.data);

    // JSON data is parsed into object
    data = JSON.parse(e.data);
    console.log(data);

    if ("requested" in data) {
          // this is instruction that was echoed from server + data as response
          instruction = data.requested;  
            
          if (instruction in callbacksWifi) 
              callbacksWifi[instruction](data);
      } else if ("serverPush" in data) {
             // this is instruction that was echoed from server + data as response
             
             instruction = data.serverPush;  
             if (instruction in callbacksWifi) 
                 callbacksWifi[instruction](data);
      }
};

wifiSocket.onclose = function() {
    console.log('Wifi Web socket is closed');
};
