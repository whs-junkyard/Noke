var express = require('express');
var fs = require('fs');
var io = require('socket.io');
var proc = require('child_process');
var midicore = require('./midicore');

/* Web system */
var app = express.createServer();
app.configure('development', function(){
    app.use(express.static(__dirname + '/html'));
    app.use(express.static(__dirname + '/midi'));
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});
app.get('/:file.cur', function(req, res){
	res.contentType('json');
	f=req.params.file;
	if(!f.match(/^([0-9A-Z]+)$/)){
		res.send("hack");
		return;
	}
	// get resolution
	midicore.resolution(function(mdres){
		fs.readFile('midi/Cursor/'+f+".cur", function (err, data) {
			if (err) throw err;
			cursor = [];
			i=0;
			while(i<data.length){
				if(i%2 == 1){
					i++;
					continue;
				}
				p1 = data[i];
				p2 = data[i+1];
				if(p2==255||p2===undefined) break;
				//cursor.push((p1+p2) * 256);
				//(($c * 256) + ($b * 1)) * resolution / 24  
				cursor.push(((p2*256) + p1) * mdres.resolution / 24);
				i++;
			}
			res.send(JSON.stringify(cursor));
		});
	});
});
app.listen(9998);

/* Midicore */
var midiproc = proc.spawn('java', ['midicore.Main', '9997']);
process.on('exit', function (){
	midiproc.kill('SIGHUP');
	console.log("SIGHUPed midicore");
});
process.on('SIGINT', function () {
	process.exit(0);
});
midiproc.on('exit', function(){
	console.error("midicore died!");
	process.exit(1);
});
midiproc.stdout.on('data', function(d){
	console.log("MIDICORE out: "+d);
});
midiproc.stderr.on('data', function(d){
	console.error("MIDICORE error: "+d);
});

/* Socket system */
var socket = io.listen(app);
var playing;

function midiPoller(){
	midicore.send(["isplay", "bpm", "ctick"], function(d){
		d['song'] = playing;
		socket.broadcast(JSON.stringify(d));
		if(d.isplay){
			midicore.send(["time", "key", "ctick"], function(d){
				socket.broadcast(JSON.stringify(d));
				setTimeout(midiPoller, 100);
			});
		}else{
			setTimeout(midiPoller, 100);
		}
	});
}

var isStarted=false;
/**
 * Finds out whether midicore is ready or not
 */
function pollMidicore(){
	midicore.send("isplay", function(){
		clearTimeout(pmdc);
		if(isStarted) return;
		isStarted=true;
		midicore.clear();
		console.log("Noke ready. http://localhost:9998/");
		playing = "900159";
		midicore.send(["sq midi/Midi/900159.mid", "p"]);
		setTimeout(midiPoller, 100);
	});
}
pmdc = setInterval(pollMidicore, 50);
