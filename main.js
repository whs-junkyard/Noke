var http = require('http');
var fs = require('fs');
var io = require('socket.io');
var midicore = require('./midicore');

server = http.createServer(function(req, res){ 
	res.writeHead(200, {'Content-Type': 'text/html'}); 
	fs.readFile("index.html", function(e,d){
		res.end(d);
	});
});
server.listen(9998);

var socket = io.listen(server);

// poll it!
function midiPoller(){
	midicore.send(["isplay", "bpm"], function(d){
		if(d.isplay){
			midicore.send(["time", "key"], function(d){
				socket.broadcast(JSON.stringify(d));
				setTimeout(midiPoller, 50);
			});
		}
		socket.broadcast(JSON.stringify(d));
		if(!d.isplay){
			setTimeout(midiPoller, 100);
		}
	});
}
midiPoller();
