var express = require('express');
var fs = require('fs');
var io = require('socket.io');
var proc = require('child_process');
var midicore = require('./midicore');
var Iconv  = require('iconv').Iconv;
var path = require('path');
var settings = require('./settings');

var playing, queue=[], cache=[];

/**
 * Fisher Yates shuffling algorithm
 * @see http://sedition.com/perl/javascript-fy.html
 * @param {Array}
 */
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
    app.use(express.static(settings.path));
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});
/**
 * Static pictures list
 */
app.get('/pictures.json', function(req, res){
	res.contentType('json');
	fs.readdir(path.join(settings.path, "Pictures"), function(err, f){
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
/**
 * Lyr reader (and convertor to UTF-8)
 */
app.get('/:file.lyr', function(req, res){
	f=req.params.file;
	if(!f.match(/^([0-9A-Z]+)$/)){
		res.send("hack");
		return;
	}
	res.contentType('text');
	// find it!
	function foundCb(f){
		foundCb=function(){};
		fs.readFile(f, function (err, data) {
			if (err) return;
			conv = new Iconv('TIS-620', 'UTF-8');
			res.send(conv.convert(data));
		});
	}
	if(cache[f+".lyr"]){
		foundCb(cache[f+".lyr"]);
	}else{
		basepath = path.join(settings.path, "Lyrics", f[0], f);
		fs.stat(basepath+".lyr", function(err){
			if(!err){
				cache[f+".lyr"] = basepath+".lyr";
				foundCb(basepath+".lyr");
			}
		});
		fs.stat(basepath+".LYR", function(err){
			if(!err){
				cache[f+".lyr"] = basepath+".LYR";
				foundCb(basepath+".LYR");
			}
		});
	}
});
/**
 * Cursor reader (and convertor to JSON)
 * DON'T call this method for song not playing, it might break
 */
app.get('/:file.cur', function(req, res){
	res.contentType('json');
	f=req.params.file;
	if(!f.match(/^([0-9A-Z]+)$/)){
		res.send("hack");
		return;
	}
	// get resolution
	midicore.resolution(function(mdres){
		function foundCb(f){
			foundCb=function(){};
			fs.readFile(f, function (err, data) {
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
		}
		if(cache[f+".cur"]){
			foundCb(cache[f+".cur"]);
		}else{
			basepath = path.join(settings.path, "Cursor", f[0], f);
			fs.stat(basepath+".cur", function(err){
				if(!err){
					cache[f+".cur"] = basepath+".cur";
					foundCb(basepath+".cur");
				}
			});
			fs.stat(basepath+".CUR", function(err){
				if(!err){
					cache[f+".cur"] = basepath+".CUR";
					foundCb(basepath+".CUR");
				}
			});
		}
	});
});
app.listen(settings.port);

/* Midicore */
if(settings.midicore){
	var midiproc = proc.spawn('java', ['midicore.Main', settings.midicore]);
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
}

/* Finder */
var file = fs.readFileSync(settings.lister, "UTF-8").replace(/\n$/, "").split("\n");
file = file.map(function(d){return d.split("^");});
function finder(query){
	result = [];
	totalFound = 0;
	resultType = [[],[],[]];
	searchNum = query.match(/^[0-9]+$/);
	function formatData(d){
		// push to cache too
		cache[path.basename(d[0]).toLowerCase()] = d[0];
		return {
			"code": path.basename(d[0]).replace(/\.lyr$/i, ""),
			"file": d[0],
			"name": d[1],
			"artist": d[2],
			"key": d[3],
			"lyric": d[4]
		};
	}
	for(var d in file){
		d = file[d];
		if(searchNum && path.basename(d[0]).replace(/\.lyr$/i, "").indexOf(query) == 0){
			totalFound++;
			result.push(formatData(d));
			continue;
		}
		ser = [1,2,4];
		for(var i in ser){
			x = ser[i];
			if(d[x].toLowerCase().indexOf(query) == 0){
				totalFound++;
				result.push(formatData(d));
				break;
			}
			if(d[x].toLowerCase().indexOf(query) != -1){
				totalFound++;
				resultType[i].push(formatData(d));
				break;
			}
		}
		if(totalFound > 100) break;
	}
	resultType.forEach(function(v){
		v.forEach(function(x){
			result.push(x);
		});
	});
	return result;
}

/* Socket system */
var socket = io.listen(app);
socket.on('connection', function(client){ 
	client.on('message', function(d){
		if(d.type == "find"){
			out = finder(d.name);
			client.send({type: "find", data: out});
		}else if(d.type == "stop"){
			midicore.stop();
		}else if(d.type == "queue"){
			d.name = d.name.toString();
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

/**
 * Channel mute status. True=Not muted
 * @type {Array.<boolean>}
 */
var channels = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
/**
 * Number of channels loaded
 * @type {number}
 */
var channelLoad = 0;
/**
 * Loads channel mute status
 * @param {boolean} If false, don't poll it, else poll it every 500ms
 */
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

/**
 * Poll midicore for data
 */
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
				// find
				function foundCb(f){
					foundCb=function(){};
					midicore.send(["s", "sq "+f, "p"]);
				}
				if(cache[song+".mid"]){
					foundCb(cache[song+".mid"]);
				}else{
					basepath = path.join(settings.path, "Song", song[0], song);
					fs.stat(basepath+".mid", function(err){
						if(!err){
							cache[song+".mid"] = basepath+".mid";
							foundCb(basepath+".mid");
						}
					});
					fs.stat(basepath+".MID", function(err){
						if(!err){
							cache[song+".mid"] = basepath+".MID";
							foundCb(basepath+".MID");
						}
					});
				}
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
		console.log("Noke ready. http://localhost:"+settings.port+"/");
		playing = "900159";
		setTimeout(midiPoller, 100);
		setTimeout(channelPoller, 100);
	});
}
if(settings.midicore)
	pmdc = setInterval(pollMidicore, 50);
else{
	midiPoller();
	channelPoller();
	console.log("Noke ready. http://localhost:"+settings.port+"/");
}
