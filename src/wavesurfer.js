'use strict';

var WaveSurfer = {
    defaultParams: {
        skipLength: 2
    },

    init: function (params) {
        var my = this;

        // extract relevant parameters (or defaults)
        this.params = params;
        Object.keys(this.defaultParams).forEach(function (key) {
            if (!(key in my.params)) {
                my.params[key] = my.defaultParams[key];
            }
        });

        if (this.params.audio) {
            var backend = WaveSurfer.Audio;
        } else {
            backend = WaveSurfer.WebAudio;
        }

        this.backend = Object.create(backend);
        this.backend.init(this.params);

        this.drawer = Object.create(WaveSurfer.Drawer);
        this.drawer.init(this.params);

        this.bindClick(this.params.canvas, function (percents) {
            my.playAt(percents);
        });
    },

    onAudioProcess: function () {
        if (!this.backend.isPaused()) {
            this.drawer.progress(this.backend.getPlayedPercents());
        }
    },

    playAt: function (percents) {
        this.backend.play(this.backend.getDuration() * percents);
    },

    pause: function () {
        this.backend.pause();
    },

    playPause: function () {
        if (this.backend.paused) {
            this.playAt(this.backend.getPlayedPercents() || 0);
        } else {
            this.pause();
        }
    },

    skipBackward: function(seconds) {
        this.skip(seconds || -this.params.skipLength);
    },

    skipForward: function(seconds) {
        this.skip(seconds || this.params.skipLength);
    },

    skip: function(offset) {
        var timings = this.timings(offset);
        this.playAt(timings[0] / timings[1]);
    },

    marks: 0,
    mark: function(options) {
        options = options || {};

        var timings = this.timings(0);

        var marker = {
            width: options.width,
            color: options.color,
            percentage: timings[0] / timings[1],
            position: timings[0]
        };

        var id = options.id || '_m' + this.marks++;

        this.drawer.markers[id] = marker;
        if (this.backend.paused) this.drawer.redraw();
        return marker;
    },

    timings: function(offset) {
        var position = this.backend.getCurrentTime() || 0;
        var duration = this.backend.getDuration() || 1;
        position = Math.max(0, Math.min(duration, position + offset));
        return [position, duration];
    },

    drawBuffer: function () {
        if (this.backend.currentBuffer) {
            var my = this;
            this.backend.bindUpdate(function () {
                my.onAudioProcess();
            });
            this.drawer.drawBuffer(this.backend.currentBuffer);
        }
    },

    /**
     * Streams audio through HTML5 Audio.
     */
    streamUrl: function (url) {
        var my = this;
        var audioApi = Object.create(WaveSurfer.Audio);

        var audio = this.backend.streamUrl(
            url,
            // on timeupdate
            function (pcm) {
                var percents = my.backend.getPlayedPercents();
                my.drawer.setCursor(percents);
                my.drawer.drawStreamFrame(pcm, percents);
            },
            // on canplay
            function () {
                my.drawer.setMinWidth(~~my.backend.getDuration());
                my.backend.play();
            }
        );

        this.params.audio = audio;
        this.backend = audioApi;
        this.backend.init(this.params);
    },

    /**
     * Loads an audio file via XHR.
     */
    load: function (url) {
        var my = this;
        var xhr = new XMLHttpRequest();
        xhr.responseType = 'arraybuffer';

        xhr.addEventListener('progress', function (e) {
            var percentComplete;
            if (e.lengthComputable) {
                percentComplete = e.loaded / e.total;
            } else {
                // TODO
                // for now, approximate progress with an asymptotic
                // function, and assume downloads in the 1-3 MB range.
                percentComplete = e.loaded / (e.loaded + 1000000);
            }
            my.drawer.drawLoading(percentComplete);
        }, false);

        xhr.addEventListener('load', function (e) {
            my.drawer.drawLoading(1);
            my.backend.loadData(
                e.target.response,
                my.drawBuffer.bind(my),
                my.streamUrl.bind(my, url)
            );
        }, false);

        xhr.open('GET', url, true);
        xhr.send();
    },

    /**
     * Loads an audio file via drag'n'drop.
     */
    bindDragNDrop: function (dropTarget) {
        var my = this;
        var reader = new FileReader();
        reader.addEventListener('load', function (e) {
            my.backend.loadData(
                e.target.result,
                my.drawBuffer.bind(my)
            );
        }, false);

        (dropTarget || document).addEventListener('drop', function (e) {
            e.preventDefault();
            var file = e.dataTransfer.files[0];
            file && reader.readAsArrayBuffer(file);
        }, false);
    },

    /**
     * Click to seek.
     */
    bindClick: function (element, callback) {
        var my = this;
        element.addEventListener('click', function (e) {
            var relX = e.offsetX;
            if (null == relX) { relX = e.layerX; }
            callback(relX / this.clientWidth);
        }, false);
    }
};
