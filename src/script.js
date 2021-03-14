var ffmpeg = require("fluent-ffmpeg");

var silence_starts = [];
var silence_ends = [];
var black_starts = [];
var black_ends = [];

function searchSilences(file) {
  silence_starts = [];
  silence_ends = [];

  var proc2 = ffmpeg(file)
    .audioFilters("silencedetect=n=-30dB:d=3")
    .format("null")
    .on("start", function (cmdline) {
      document.getElementById("silences").innerHTML = "";
      document.getElementById("silences_progress").style.display = "block";
      document.getElementById("silences_message").style.display = "block";
    })
    .on("error", function (err, stdout, stderr) {
      console.log("Error: " + err.message);
      console.log("ffmpeg output:\n" + stdout);
      console.log("ffmpeg stderr:\n" + stderr);
    })
    .on("progress", function (progress) {
      document.getElementById("silences_message").innerText =
        Math.round(progress.percent * 100) / 100 + "%";
      document
        .getElementById("silences_progress")
        .querySelector(".progress").style.width =
        Math.round(progress.percent * 100) / 100 + "%";
    })
    .on("stderr", function (line) {
      var re_s = /silence_start: (\d{0,4}\.\d{0,4})/i;
      var found_s = line.match(re_s);

      if (found_s != null) {
        silence_starts.push(found_s[1]);
      }

      var re_e = /silence_end: (\d{0,4}\.\d{0,4})/i;
      var found_e = line.match(re_e);

      if (found_e != null) {
        silence_ends.push(found_e[1]);
      }
    })
    .on("end", function () {
      console.log("Finished processing");

      document.getElementById("silences_progress").style.display = "none";
      document.getElementById("silences_message").style.display = "none";

      for (let i = 0; i < silence_starts.length; i++) {
        el = document.createElement("li");
        el.innerHTML =
          secondsToHMS(silence_starts[i]) +
          " - " +
          secondsToHMS(silence_ends[i]);
        document.getElementById("silences").appendChild(el);
      }
    })
    .output("nul")
    .run();
}

function generateWaveform(file) {
  var proc = ffmpeg(file)
    .complexFilter([
      "[0:a]aformat=channel_layouts=mono, \
  compand=gain=-6, \
  showwavespic=s=600x120:colors=#9cf42f[fg]; \
  color=s=600x120:color=#44582c, \
  drawgrid=width=iw/10:height=ih/5:color=#9cf42f@0.1[bg]; \
  [bg][fg]overlay=format=auto,drawbox=x=(iw-w)/2:y=(ih-h)/2:w=iw:h=1:color=#9cf42f",
    ])
    .on("start", (cmdline) => console.log(cmdline))
    .on("error", function (err, stdout, stderr) {
      console.log("Error: " + err.message);
      console.log("ffmpeg output:\n" + stdout);
      console.log("ffmpeg stderr:\n" + stderr);
    })
    .on("progress", function (progress) {
      console.log("Processing: " + progress.percent + "% done");
    })
    .on("end", function () {
      document.getElementById("waveform").src =
        "waveform.png?" + new Date().getTime();
    })
    .outputOptions(["-vframes 1"])
    .save("src/waveform.png");
}

function searchBlackFrames(file) {
  black_starts = [];
  black_ends = [];

  var proc3 = ffmpeg(file)
    .videoFilters("blackdetect=d=3:pic_th=0.9")
    .format("null")
    .on("start", function (cmdline) {
      document.getElementById("blackness").innerHTML = "";
      document.getElementById("empty_frames_progress").style.display = "block";
      document.getElementById("blackness_message").style.display = "block";
    })
    .on("error", function (err, stdout, stderr) {
      console.log("Error: " + err.message);
      console.log("ffmpeg output:\n" + stdout);
      console.log("ffmpeg stderr:\n" + stderr);
    })
    .on("progress", function (progress) {
      document.getElementById("blackness_message").innerText =
        Math.round(progress.percent * 100) / 100 + "%";
      console.log("Processing: " + progress.percent + "% done");
      document
        .getElementById("empty_frames_progress")
        .querySelector(".progress").style.width =
        Math.round(progress.percent * 100) / 100 + "%";
    })
    .on("stderr", function (line) {
      var re_s = /black_start:(\d{0,4}\.\d{0,4}) black_end:(\d{0,4}\.\d{0,4})/i;
      var found_s = line.match(re_s);

      if (found_s != null) {
        console.log(found_s);
        black_starts.push(parseInt(found_s[1]));
        black_ends.push(parseInt(found_s[2]));
        console.log(line);
      }
    })
    .on("end", function () {
      console.log("Finished processing");

      document.getElementById("empty_frames_progress").style.display = "none";
      document.getElementById("blackness_message").style.display = "none";

      for (let i = 0; i < silence_starts.length - 1; i++) {
        el = document.createElement("li");
        el.innerHTML =
          secondsToHMS(black_starts[i]) + " - " + secondsToHMS(black_ends[i]);
        document.getElementById("blackness").appendChild(el);
      }
    })
    .output("nul")
    .run();
}

function getVideoMetadata(file) {
  console.log("Getting file metadata");
  ffmpeg(file).ffprobe(function (err, data) {
    console.log("file2 metadata:");
    console.log(data.streams[0].codec_name);
  });
}

function secondsToHMS(seconds) {
  console.log(seconds);
  return new Date(seconds * 1000).toISOString().substr(11, 8);
}

document.addEventListener("drop", (event) => {
  event.preventDefault();
  event.stopPropagation();

  for (const f of event.dataTransfer.files) {
    // Using the path attribute to get absolute file path
    console.log("File Path of dragged files: ", f.path);
    getVideoMetadata(f.path);
    generateWaveform(f.path);
    searchBlackFrames(f.path);
    searchSilences(f.path);
  }
});

document.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

document.addEventListener("dragenter", (event) => {
  console.log("File is in the Drop Space");
});

document.addEventListener("dragleave", (event) => {
  console.log("File has left the Drop Space");
});
