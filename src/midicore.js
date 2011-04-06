/**
 * @license Midicore connector for Node.js
 * Copyright 2011 Manatsawin Hanmongkolchai
 * This software is licensed under GNU General Public License v3
 * or later.
 */
var dgram = require('dgram');
var client = dgram.createSocket("udp6");
exports.debug = false;

/**
 * Registered callback
 * @type {Array.<Function>}
 */
var callback = [];
/**
 * Target host
 * @type {Array.<(string|number)>}
 */
exports.target = ["127.0.0.1", "9997"];

client.on("message", function (msg, info){
	if(exports.debug) console.log("got: " + msg + " from " + info.address);
	// 1: split
	msg = msg.toString().trim();
	pmsg = msg.split("-").slice(1);
	out = {};
	// 2: parse each one
	pmsg.forEach(function(d){
		d = d.trim().split(" ");
		// We're "Java"Script afterall
		txt = d.slice(1).join(" ");
		try{
			out[d[0]] = JSON.parse(txt);
		}catch(err){
			out[d[0]] = txt;
		}
	});
	
	if(callback.length > 0){
		cb = callback.shift();
		cb(out);
	}else{
		console.error("ERR: Message have no receiver!");
	}
});

/**
 * Send message to midicore
 * @param {(Array.<string>|string)} Message, if array will send multiple ones
 * @param {Function} Callback function cb({"isplay": true})
 */
exports.send = function(message, cb){
	if(message.join){
		msg = message.join("-");
	}else if(typeof message == "object"){
		msg = "";
		for(k in message){
			d = message[k];
			if(message.hasOwnProperty(k)){
				if(d !== null && d !== undefined)
					msg += "-"+k+" "+d;
				else
					msg += "-"+k;
			}
		}
	}else{
		msg = message;
	}
	message = new Buffer(msg);
	if(cb)
		callback.push(cb);
	else
		callback.push(function(){
			if(exports.debug) console.warn("Message have no receiver!");
		});
	client.send(message, 0, message.length, exports.target[1], exports.target[0],
		function (err, bytes) {
			if (err) {
				throw err;
			}
			if(exports.debug) console.log("Wrote " + bytes + " bytes to socket.");
		}
	);
}

/**
 * Clear the command stack, use when you polled midicore
 * but it's not responding
 */
exports.clear = function(){
	callback = [];
}

/**
 * List of valid commands
 * @type {Array.<string>}
 */
exports.commands = ["sequence", "sq", "soundfont", "sf", "play", "p", "purse", "pu", "mute", "m", "stop", "st", "device", "dev", "control", "pitch", "bpmc", "resolution", "res", "timesignature", "time", "keysignature", "key", "cpitch", "bpm", "ctick", "ct", "mxtick", "mxtime", "ctime", "sequenceexists", "se", "ischannelmute", "im", "isplay", "i", "devlist", "dl", "verbose", "v", "end"];

exports.commands.forEach(function(n){
	exports[n] = function(){
		arg = [];
		d = arguments[0];
		if(typeof d == "function"){
			arg.push({});
			arg[0][n] = null;
			arg.push(d);
		}else{
			arg.push({});
			arg[0][n] = d;
		}
		if(arguments.length >= 2) arg.push(arguments[1]);
		if(exports.debug) console.log(arg);
		exports.send.apply(null, arg);
	}
});
