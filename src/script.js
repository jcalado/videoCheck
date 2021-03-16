var ffmpeg = require("fluent-ffmpeg");
var path = require("path");
const { ipcRenderer } = require("electron");

var silence_starts = [];
var silence_ends = [];
var black_starts = [];
var black_ends = [];
var appDataPath = '';
waveformPath = '';


ipcRenderer.send('getAppDataPath');
ipcRenderer.on('setAppDataPath', (event, arg) => {
  appDataPath = arg;
  console.log(appDataPath);
  waveformPath = path.join(appDataPath, 'waveform.png')
  console.log(waveformPath);
})

function searchSilences(file) {
  silence_starts = [];
  silence_ends = [];

  var proc2 = ffmpeg(file)
    .audioFilters("silencedetect=n=-35dB:d=3")
    .format("null")
    .on("start", function (cmdline) {
      document.getElementById("silences").innerHTML = "";
      document.getElementById("silences_progress").style.display = "block";
      document.getElementById("silences_message").style.display = "block";
    })
    .on("error", function (err, stdout, stderr) {
      console.log("Error: " + err.message);
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
      document.getElementById("silences_progress").style.display = "none";
      document.getElementById("silences_message").style.display = "none";

      for (let i = 0; i < silence_starts.length; i++) {
        el = document.createElement("li");
        el.innerHTML =
          secondsToHMS(silence_starts[i]) +
          " - " +
          secondsToHMS(silence_ends[i]) +
          " (" +
          secondsToHMS(silence_ends[i] - silence_starts[i]) +
          ")";
        document.getElementById("silences").appendChild(el);
      }

      if (silence_starts.length === 0) {
        triggerOKFor(document.querySelector("#silences_title"));
      }

      document
        .getElementById("silences")
        .scrollIntoView({ block: "start", behavior: "smooth" });
    })
    .output("nul")
    .run();
}

function triggerOKFor(element) {
  var silence_success_tag = document.createElement('span');
  silence_success_tag.className = 'success';
  silence_success_tag.innerText = 'OK';

  element.insertAdjacentElement('afterend', silence_success_tag);
}

function generateWaveform(file) {
  var proc = ffmpeg(file)
    .complexFilter([
      "[0:a]aformat=channel_layouts=mono, \
  compand=gain=4, \
  showwavespic=s=1000x120:colors=#9cf42f[fg]; \
  color=s=1000x120:color=#44582c, \
  drawgrid=width=iw/10:height=ih/5:color=#9cf42f@0.1[bg]; \
  [bg][fg]overlay=format=auto,drawbox=x=(iw-w)/2:y=(ih-h)/2:w=iw:h=1:color=#9cf42f",
    ])
    .on("start", function (cmdline) {
      document.getElementById("waveformProgress").style.display = "block";
      document.getElementById("waveformProgress").innerText = "LOADING";
    })
    .on("error", function (err, stdout, stderr) {
      console.log("Error: " + err.message);
    })
    .on("progress", function (progress) {
      //document.getElementById('waveformProgress').innerText = progress.percent * 100 + "%";
    })
    .on("end", function () {
      document.getElementById("waveformImage").src =
        waveformPath + "?" + new Date().getTime();
      document.getElementById("waveformProgress").style.display = "none";
    })
    .outputOptions(["-vframes 1"])
    .save(path.join(appDataPath, 'waveform.png'));
}

function searchBlackFrames(file) {
  black_starts = [];
  black_ends = [];

  var proc3 = ffmpeg(file)
    .videoFilters("blackdetect=d=3:pic_th=0.8")
    .format("null")
    .on("start", function (cmdline) {
      document.getElementById("blackness").innerHTML = "";
      document.getElementById("empty_frames_progress").style.display = "block";
      document.getElementById("blackness_message").style.display = "block";
    })
    .on("error", function (err, stdout, stderr) {
      console.log("Error: " + err.message);
    })
    .on("progress", function (progress) {
      document.getElementById("blackness_message").innerText =
        Math.round(progress.percent * 100) / 100 + "%";

      document
        .getElementById("empty_frames_progress")
        .querySelector(".progress").style.width =
        Math.round(progress.percent * 100) / 100 + "%";
    })
    .on("stderr", function (line) {
      var re_s = /black_start:(\d{0,4}\.\d{0,4}) black_end:(\d{0,4}\.\d{0,4})/i;
      var found_s = line.match(re_s);

      if (found_s != null) {
        black_starts.push(parseInt(found_s[1]));
        black_ends.push(parseInt(found_s[2]));
      }
    })
    .on("end", function () {

      document.getElementById("empty_frames_progress").style.display = "none";
      document.getElementById("blackness_message").style.display = "none";

      for (let i = 0; i < silence_starts.length - 1; i++) {
        el = document.createElement("li");
        el.innerHTML =
          secondsToHMS(black_starts[i]) + " - " + secondsToHMS(black_ends[i]);
        document.getElementById("blackness").appendChild(el);
      }

      if (black_starts.length === 0) {
        triggerOKFor(document.querySelector(".panel:nth-child(4) h3"))
      }

      document
        .getElementById("blackness")
        .scrollIntoView({ block: "start", behavior: "smooth" });
    })
    .output("nul")
    .run();
}

function getVideoMetadata(file) {
  document.getElementById("fileName").innerText = path.basename(file);

  ffmpeg(file).ffprobe(function (err, data) {
    data.streams.forEach((stream) => {
      if (stream.codec_type == "video") {
        document.getElementById("videoCodec").innerText =
          stream.codec_long_name;
        document.getElementById("videoCodecProfile").innerText = stream.profile;
        document.getElementById("videoBitrate").innerText =
          Math.round(parseInt(stream.bit_rate / 1000 / 1000) * 100) / 100 +
          " Mbps";
        document.getElementById("videoResolution").innerText =
          stream.width + "x" + stream.height;
        document.getElementById("videoFrameRate").innerText =
          stream.r_frame_rate;
        document.getElementById("videoFieldOrder").innerText =
          stream.field_order;
        document.getElementById("mediaDuration").innerText = secondsToHMS(
          parseInt(stream.duration)
        );
      }
      if (stream.codec_type == "audio") {
        document.getElementById("audioCodec").innerText = stream.codec_name;
        document.getElementById("audioBitrate").innerText =
          Math.round(parseInt(stream.bit_rate / 1000) * 100) / 100 + " Kbps";
        document.getElementById("audioSampleRate").innerText =
          stream.sample_rate;
        document.getElementById("audioChannels").innerText = stream.channels;
        document.getElementById("audioChannelLayout").innerText =
          stream.channel_layout;
      }
    });
  });
}

function secondsToHMS(seconds) {
  return new Date(seconds * 1000).toISOString().substr(11, 8);
}

document.addEventListener("drop", (event) => {
  event.preventDefault();
  event.stopPropagation();

  for (var f of event.dataTransfer.files) {
    hideDropZone();

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
  showDropZone();
});

document.addEventListener("dragleave", (event) => {
});

ipcRenderer.on("open-file", (event, arg) => {
  hideDropZone();
  getVideoMetadata(arg);
  generateWaveform(arg);
  searchBlackFrames(arg);
  searchSilences(arg);
});

function showDropZone() {
  document.getElementById("drop").style.display = "flex";
  document.querySelector("html").style.overflow = "hidden";

  document.querySelectorAll(".success").forEach((success) => {
    success.remove();
  });
}

function hideDropZone() {
  document.getElementById("drop").style.display = "none";
  document.querySelector("html").style.overflow = "auto";
}

