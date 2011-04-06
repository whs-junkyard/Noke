var express = require('express');
var fs = require('fs');
var io = require('socket.io');
var proc = require('child_process');
var midicore = require('./midicore');
var Iconv  = require('iconv').Iconv;

var playing, queue=[];

/* shuffle -- http://sedition.com/perl/javascript-fy.html */
function fisherYates ( myArray ) {
  var i = myArray.length;
  if ( i == 0 ) return false;
  while ( --i ) {
     var j = Math.floor( Math.random() * ( i + 1 ) );
     var tempi = myArray[i];
     var tempj = myArray[j];
     myArray[i] = tempj;
     myArray[j] = tempi;
   }
}

/* Web system */
var app = express.createServer();
app.configure('development', function(){
    app.use(express.static(__dirname + '/html'));
    app.use(express.static(__dirname + '/midi'));
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});
app.get('/pictures.json', function(req, res){
	res.contentType('json');
	fs.readdir("~/midi/Pictures/", function(err, f){
		if(!f){
			return res.send("[]");
		}
		f = f.filter(function(x){
			return x.match(/\.(gif|jp[e]*g|png)$/);
		});
		fisherYates(f);
		res.send(JSON.stringify(f));
	});
});
app.get('/:file.lyr', function(req, res){
	f=req.params.file;
	if(!f.match(/^([0-9A-Z]+)$/)){
		res.send("hack");
		return;
	}
	res.contentType('text');
	fs.readFile('~/midi/Lyrics/'+f+".lyr", function (err, data) {
		if (err) throw err;
		conv = new Iconv('TIS-620', 'UTF-8');
		res.send(conv.convert(data));
	});
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
		fs.readFile('~/midi/Cursor/'+f+".cur", function (err, data) {
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
	midicore.end();
	/*midiproc.kill('SIGHUP');
	console.log("SIGHUPed midicore");*/
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
socket.on('connection', function(client){ 
	client.on('message', function(d){
		if(d.type == "find"){
			if(d.name) out = ["เธอจะอยู่กับฉันตลอดไป"];
			else out =[];
			client.send({type: "find", data: out});
		}else if(d.type == "stop"){
			midicore.stop();
		}else if(d.type == "queue"){
			if(!d.name.match(/^([0-9A-Z]+)$/)){
				return;
			}
			queue.push(d.name);
		}else if(d.type == "mute"){
			midicore.mute(parseInt(d.channel)-1, function(){
				channelPoller(false);
			});
		}
	});
});

var channels = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
var channelLoad = 0;
function channelPoller(poll){
	i=0;
	channelLoad = 0;
	while(i<16){
		midicore.ischannelmute(i, (function(i, d){
			channels[i] = !d.ischannelmute;
			channelLoad += 1;
			if(channelLoad == 16){
				socket.broadcast({"type": "channel", "data": channels});
				channelLoad = 0;
				if(poll !== false)
					setTimeout(channelPoller, 500);
			}
		}).bind(null, i));
		i++;
	}
}

function midiPoller(){
	midicore.send(["isplay", "bpm"], function(d){
		d['song'] = playing;
		d['queue'] = queue;
		socket.broadcast({"type": "song", "data": d});
		if(d.isplay){
			midicore.send(["time", "key", "ctick", "mxtick", "resolution"], function(d){
				socket.broadcast({"type": "song", "data": d});
				setTimeout(midiPoller, d.resolution);
			});
		}else{
			if(queue.length > 0){
				song = queue.shift();
				midicore.send(["sq ~/midi/Midi/"+song+".mid", "p"]);
				playing = song;
			}else{
				playing=null;
			}
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
		setTimeout(midiPoller, 100);
		setTimeout(channelPoller, 100);
	});
}
pmdc = setInterval(pollMidicore, 50);
