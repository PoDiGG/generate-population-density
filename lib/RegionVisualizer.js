'use strict';

const fs = require('fs');
const Canvas = require('canvas');
const Image = Canvas.Image;

const Point = require('./Point.js');

class RegionVisualizer {
    constructor(region) {
        this.region = region;
    }

    render() {
        var size = new Point(this.region.max.x - this.region.min.x, this.region.max.y - this.region.min.y);
        var canvas = new Canvas(size.x, size.y);
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, size.x, size.y);

        var defaultColor = this.bgcolor || [0, 0, 0, 255];
        var canvasData = ctx.createImageData(size.x, size.y);
        for (var i=0; i<canvasData.data.length; i+=4){
            canvasData.data[i] = defaultColor[0]; // r
            canvasData.data[i+1] = defaultColor[1];
            canvasData.data[i+2] = defaultColor[2];
            canvasData.data[i+3] = defaultColor[3];
        }

        var maxValue = 0;
        for(var id in this.region._data){
            maxValue = Math.max(this.region._data[id], maxValue);
        }

        for (var i = 0; i < this.region._data.length; i++) {
            var value = this.region._data[i];
            if (value) {
                var x = Math.floor(i % size.x);
                var y = Math.floor(i / size.x);

                // MDC ImageData:
                // data = [r1, g1, b1, a1, r2, g2, b2, a2 ...]
                var pixelColorIndex = y * size.x * 4 + x * 4;

                var color = this.hsla2rgba(this.value2Color(value / maxValue));
                canvasData.data[pixelColorIndex] = color[0]; //r
                canvasData.data[pixelColorIndex+1] = color[1]; //g
                canvasData.data[pixelColorIndex+2] = color[2]; //b
                canvasData.data[pixelColorIndex+3] = color[3]; //a
            }
        }

        ctx.putImageData(canvasData, 0, 0);

        // Write to file
        var out = fs.createWriteStream('region.png');
        var stream = canvas.pngStream();
        stream.on('data', function(chunk){
            out.write(chunk);
        });

        stream.on('end', function(){
            console.log('saved png');
        });
    }

    // function copied from:
    // http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript
    hsla2rgba(h, s, l, a){
        var r, g, b;

        if(s == 0){
            r = g = b = l;
        }else{
            var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            var p = 2 * l - q;
            r = this.hue2rgb(p, q, h + 1/3);
            g = this.hue2rgb(p, q, h);
            b = this.hue2rgb(p, q, h - 1/3);
        }

        return [r * 255, g * 255, b * 255, a * 255];
    }

    hue2rgb(p, q, t){
        if(t < 0) t += 1;
        if(t > 1) t -= 1;
        if(t < 1/6) return p + (q - p) * 6 * t;
        if(t < 1/2) return q;
        if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    }

    value2Color(value){
        var h = (1 - value);
        var l = value * 0.6;
        var s = 0.8;
        var a = 1;
        return [h, s, l, a];
    }
}

module.exports = RegionVisualizer;
