"use strict";

var utils =    require(__dirname + '/lib/utils'); 
var adapter = utils.adapter('eibd');
var fs = require('fs');
var traverse = require('traverse');
var eibd = require('eibd');
var xml2js = require('xml2js');
var xmlparser  = new xml2js.Parser();
var gas = {};
var dpts = {};
var requestqueue = new Array();

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('ready', function () {
	get_dpts(__dirname + '/dpt.json', function(result){
		get_gas(__dirname + '/sh.xml',function(result){
			main();
		});
	});
});


function getgabyid(id){
	var result;
	traverse(gas).forEach(function(node){
		if (id == node.myid){
			result = node;
		};
	});
	return result;
};



adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// todo
adapter.on('discover', function (callback) {

});

// todo
adapter.on('install', function (callback) {

});

// todo
adapter.on('uninstall', function (callback) {

});

// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    adapter.log.debug('objectChange ' + id + ' ' + JSON.stringify(obj));
});


adapter.on('stateChange', function (id, state) {
	adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));
	if (!state.ack) {
		var node = getgabyid(id);
		node["state"] =  state;
		node['action'] = 'groupwrite';	
		requestqueue.push(node);
		//recurseQueue();
	}
});








function get_gas(filename, callback){	
	fs.readFile(filename,  function(err, data) { 
		if (!err){
			xmlparser.parseString(data, function (err, result) {
				if (!err){
					traverse(result).forEach(function (node){
						if (node.Address){
							var myname = node["Name"].replace(".","_").replace(/\s/g,"").toLowerCase();
							var parent =  (this.parent.parent.parent.node.$["Name"].replace(".","_").replace(/\s/g,"")).toLowerCase() || "channels";
							var grandparent = (this.parent.parent.parent.parent.parent.node.$["Name"].replace(".","_").replace(/\s/g,"")).toLowerCase() || "devices";
							var datatypeinfos = get_dpt(node["dpt"] ) || get_dpt(this.parent.parent.parent.node.$["dpt"]);
							var myaccess = (node["access"] || this.parent.parent.parent.node.$["access"])|| "rw"; //assuming rw 
							var mywrite;
							var myread;
							if(myaccess== 'rw'){
								mywrite = true;
								myread = true;
							};
							if(myaccess == 'r'){
								mywrite = false;
								myread = true;
							};
							if(myaccess == 'w'){
								mywrite = true;
								myread = false;
							};
							var ga = {Name: myname  , channel: parent, device: grandparent, dptinfo: datatypeinfos, address: node["Address"], read: myread, write: mywrite, myid: adapter.name + "." + adapter.instance + "."  + grandparent + "." + parent + "."  + myname};
							gas[node["Address"]] = ga;
						};
					});
				}else{
					adapter.log.error("Could not parse xml in ga file!");
					return;
				};
				callback(gas);
			});
		}else{
			adapter.log.error("Could not open ga file.");
			return
		};
	});
};

function get_dpt(mydpt){
	var major = mydpt && mydpt.split(".")[0];
	var minor = (mydpt && ("_" + mydpt.split(".")[1]))||"";
	var result = false;
	dpts.forEach(function (dpt){
		if ((major + minor) === dpt["DPT"]){
				result = dpt;
		};
	});
	return result;
};

function get_dpts(filename, callback){
	fs.readFile(filename, function(err, data){
		if (!err){	
			dpts = JSON.parse(data);
			callback(dpts);
		}else{
			adapter.log.error("Could not read the DPT Definition file.");
			return;
		}
	});
	
};



function groupsocketlisten(opts, callback) {
	var conn = eibd.Connection();
	conn.socketRemote(opts, function(err) {
	if(err) {
		callback(err);
		return;
	}
	conn.openGroupSocket(0, function(parser) {
		callback(undefined, parser);
	});
  });
  
 
  conn.on('close', function () {
    //restart...
    setTimeout(function () { groupsocketlisten(opts, callback); }, 100);
  });
}


/*
This function accepts a ga (like 1/1/1), a type  (like DPT9), a val (like 42). 
First it searches for a ga object with the given address.
*/

function SetStatesFromGA(ga, type, val){
	var myobj = gas[ga];
	var mycommon = {};
	if (myobj){
	     adapter.getObject(myobj.device, function (err, obj){
	 	if (err) {
			adapter.log.error(err);
		}else{
		 	if (!obj){	
				adapter.log.info("Device: " + myobj.device + " not found. Creating new...");
				var mydevice = {type: 'device', common: {type: 'boolean'}, native: {id: myobj.device}};
				adapter.setObject(myobj.device, mydevice);	
			};
		};
	     });
	      adapter.getObject(myobj.device + "." + myobj.channel, function (err, obj) {
		if (err) {
			adapter.log.err(err);
		}else{
			if (!obj){	
				adapter.log.info("Channel: " + myobj.device + "." + myobj.channel + " not found. Creating new...");
				var mychannel = {type:  'channel', common: {type: 'boolean'}, native: {id: myobj.device + "." + myobj.channel}};
				adapter.setObject(myobj.device + "." + myobj.channel, mychannel);	
			};
		};
	     });
	     adapter.getObject(myobj.device + "." + myobj.channel + "." + myobj.Name, function (err,obj){
			if (err) {
				adapter.log.error(err);
			}else{
				if (!obj){
					adapter.log.info("State: " + myobj.device + "." + myobj.channel + "." + myobj.Name  + " not found. Creating new...");
					if (myobj["dptinfo"]){
						if (("DPT"+myobj["dptinfo"]["DPT"].split("_")[0]) == type){
							mycommon["type"] = myobj["dptinfo"]["Iobroker  Datentyp"];
							mycommon["min"] = myobj["dptinfo"]["min"] ;
							mycommon["max"] = myobj["dptinfo"]["max"];
							mycommon["unit"] = myobj["dptinfo"]["unit"];
							if (myobj["dptinfo"]["Iobroker Role"]) {
								mycommon["role"] = myobj["dptinfo"]["Iobroker Role"];
							}else{
								adapter.log.error("No Iobroker Role defined! This field is mandatory. You should add it to the json file to the following DPT: " + myobj["dptinfo"]["DPT"] + " ! " + myobj.Name + "!!!!!!!!!!!!!!!!!!!");
								return;
							};
							mycommon["read"] = myobj["read"];
							mycommon["write"] = myobj["write"];
							mycommon["name"] = myobj.Name;
						}else{
							adapter.log.error("DPT Missmatch! Should be: DPT" + myobj["dptinfo"]["DPT"] + " but received " + type + "! You should correct the xml file.");
							return;
						};
					}else{
						adapter.log.error("Definition of DPT " + type.replace("DPT","") + " not found! You should add it to the json file.");
						return;
					};
					var mystate = {type: 'state', common: mycommon, native: {id: myobj.device + "." + myobj.channel + "." + myobj.Name}}; 
					adapter.setObject((myobj.device + "." + myobj.channel + "." + myobj.Name), mystate);
					console.dir(mystate);
					}else{
						
						adapter.log.debug("State schon existent. Update: " + myobj.device + "." + myobj.channel + "." + myobj.Name + " -> " + val);
					};
				adapter.setState((myobj.device + "." + myobj.channel + "." + myobj.Name), transform(val,myobj["dptinfo"],"in"), true);
				
			};
		});		     
	}else{
		adapter.log.error("GA not found. You should update your xml file!");
	};
};

/*
This function transformes the values as defined in the dpt.
In the File: dpt.json you can add optional variable called: transform_in and transform_out. 
This variable should contain a string representing a transform term. 
Please look  into dpt 5_001, theres a example.
*/
function transform(val,dpt, dir){
	var result = val;
	
	if (dir == 'in'){
		if (dpt.transform_in){
			var mytransin = new Function("val","return (" + dpt.transform_in + ");") ;
			result = mytransin(val);
			console.log("Transformed: " + val + " in " + result + " !");
		}else{
			result = val;
		};
	};
	
	if (dir == 'out'){
		
		if (dpt.transform_out){
			var mytransout = new Function("val","return (" + dpt.transform_out + ");") ;
			result = mytransout(val);
			console.log("Transformed: " + val + " out " + result + " !");
		}else{
			result = val;
		};

	};
	
	if (val = 0) result=0;
	return result;
};	

function main() {
	var conn = new eibd.Connection();
	
	var opts = {
		host: "127.0.0.1",
		port: 6720
	};
	
	groupsocketlisten(opts, function(err, parser) {
		if(!err) {
			adapter.log.info('Now Listening for messages...');
			parser.on('write', function(src, dest, type, val){
				gas[dest].dtp = type;
				adapter.log.debug('Write from '+src+' to '+(gas[dest]).device + " -> " + (gas[dest]).channel  + " -> " + gas[dest].Name.replace(/\s/g, "") +': '+(val)+' ['+gas[dest].dtp+']');
		                SetStatesFromGA(dest, type, val);	
			});
			parser.on('response', function(src, dest, type, val) {
				gas[dest].dtp = type;
				adapter.log.debug('Write from '+src+' to '+(gas[dest]).device + " -> " + (gas[dest]).channel  + " -> " + gas[dest].Name.replace(/\s/g, "") +': '+(val)+'  ['+gas[dest].dtp+']');
		                SetStatesFromGA(dest, type, val); 	
			});
			parser.on('read', function(src, dest) {
				adapter.log.debug('Read from '+src+' to '+(gas[dest]).channel  + " -> " + gas[dest].Name.replace(/\s/g, ""));
			});
		} else {
			adapter.log.error('[ERROR] '+err);
		}
	});

	
	 function groupread(opts, gad, callback) {
		conn.socketRemote(opts, function(err) {
			if(err) {
				callback(err);
				return;
			}
			var address = eibd.str2addr(gad);
			conn.openTGroup(address, 0, function (err) {
				if(err) {
					callback(err);
					return;
				}
				var msg = eibd.createMessage('read');
				conn.sendAPDU(msg, callback);
			});
		});
	};
	
	
	function groupwrite(opts, gad, value, DPT, callback) {
		var address = eibd.str2addr(gad);
		conn.socketRemote(opts, function(err) {
			if (err) {
				callback(err);
				return;
			}
			conn.openTGroup(address, 1, function (err) {
				if(err) {
					callback(err);
					return;
				}
				var msg = eibd.createMessage('write', DPT, parseInt(value));
				conn.sendAPDU(msg, callback);
			});
		});
	}

	
	traverse(gas).forEach(function (node){
		if(node){
			if((node['address']) != undefined){
				if (node['read'] == true){
					node['action'] = 'request';	
					requestqueue.push(node);
					//recurseQueue();
				};
				var mycommon = {};
				mycommon["type"] = node["dptinfo"]["Iobroker  Datentyp"];
				mycommon["min"] = node["dptinfo"]["min"];
				mycommon["max"] = node["dptinfo"]["max"];
				mycommon["unit"] = node["dptinfo"]["unit"] ;
				if (node["dptinfo"]["Iobroker Role"]) {
					mycommon["role"] = node["dptinfo"]["Iobroker Role"];
				}else{
					adapter.log.error("No Iobroker Role defined! This field is mandatory. You should add it to the json file to the following DPT: " + node["dptinfo"]["DPT"] + " !" );
					return;
				};
				mycommon["read"] = node['read'];
				mycommon["write"] = node['write'];
				mycommon["name"] = node.Name;
				var mystate = {type: 'state', common: mycommon, native: {id: node.device + "." + node.channel + "." + node.Name}}; 
				//console.dir(mystate);
				adapter.setObject((node.device + "." + node.channel + "." + node.Name), mystate);
				adapter.setState((node.device + "." + node.channel + "." + node.Name), 0, true); 
			};
		};
	});



	
	var myinterval = setInterval(function(){
		if (requestqueue.length >= 1){
			adapter.log.debug("There are : " +requestqueue.length + " Requests pending!");
			var node = requestqueue.pop();
			
			
			if (node.action == 'request'){
				groupread(opts, node['address'], function(err) {
					if(err) 
					{
						adapter.log.error('[ERROR]'+err);
					} else {
						adapter.log.info('Initialabfrage :' + node['device'] + " -> " + node['address'] );
						//recurseQueue();
					};
				
				});
			};
			
			if (node.action == 'groupwrite'){
				var majordpt = "DPT" + node.dptinfo.DPT.split("_")[0];
				groupwrite(opts, node.address, transform(node.state.val,node["dptinfo"],"out"), majordpt, function(err) {
					if(err) 
					{
						adapter.log.error('[ERROR]'+err);
					} else {
						adapter.log.info('Schreibe wert :' + node['device'] + " -> " + node['address'] );
						//recurseQueue();
					};
				
				});
			};
			
		}else{
			//clearInterval(myinterval);
		};
	}, 250);
	
//Funktioniert so nicht!!!!	
	
	/*function recurseQueue(){
		var itemcount = requestqueue.length;
		
		if (itemcount > 0){
			adapter.log.info("There are : " + itemcount + " Requests pending!");
			var node = requestqueue.pop();
			
			if (node.action == 'request'){
				groupread(opts, node['address'], function(err) {
					if(err) 
					{
						adapter.log.error('[ERROR]'+err);
					} else {
						adapter.log.info('Initialabfrage :' + node['device'] + " -> " + node['address'] );
						recurseQueue();
					};
				
				});
			};
			
			if (node.action == 'groupwrite'){
				var majordpt = "DPT" + node.dptinfo.DPT.split("_")[0];
				groupwrite(opts, node.address, +node.state.val, majordpt, function(err) {
					if(err) 
					{
						adapter.log.error('[ERROR]'+err);
					} else {
						adapter.log.info('Schreibe wert :' + node['device'] + " -> " + node['address'] );
						recurseQueue();
					};
				
				});
			};
		};
	};
	*/

	  adapter.subscribeStates('*');

}






