'use strict';

const fs = require('fs');
const Point = require('../lib/Point.js');
const RegionVisualizer = require('../lib/RegionVisualizer.js');
const csvparse = require('csv-parse');
const transform = require('stream-transform');

class Region {
    static get LAT_LONG_PRECISION() {
        return 100;
    }
    static get REGION_PADDING() {
        return 0.1 * Region.LAT_LONG_PRECISION;
    };

    static latLongToPoint(lat, long) {
        return new Point(lat * Region.LAT_LONG_PRECISION | 0, long * Region.LAT_LONG_PRECISION | 0);
    };

    static pointToLatLong(point) {
        return [ point.x / Region.LAT_LONG_PRECISION, point.y / Region.LAT_LONG_PRECISION ];
    };

    constructor(min, max) {
        this.min = min;
        this.max = max;
        this._data  = new Array((this.max.x - this.min.x) * (this.max.y - this.min.y));
        console.log("region cells: " + this._data.length); // TODO
        this._codes = [];
        this._stops = new Array((this.max.x - this.min.x) * (this.max.y - this.min.y));
    }

    getPointIndex(point) {
        return (point.x - this.min.x) + (this.max.x - this.min.x) * (point.y - this.min.y);
    }

    getIndexPoint(index) {
        var div = this.max.x - this.min.x;
        return new Point(index % div + this.min.x, index / div + this.min.y);
    }

    addCode(point, code) {
        if (point.x < this.min.x || point.x > this.max.x || point.y < this.min.y || point.y > this.max.y) {
            throw new Error("Point " + point + " was outside of bounds " + this.min + " " + this.max);
        }
        this._codes[code] = point;
    }

    addStop(point) {
        if (point.x < this.min.x || point.x > this.max.x || point.y < this.min.y || point.y > this.max.y) {
            //throw new Error("Point " + point + " was outside of bounds " + this.min + " " + this.max);
        } else {
            this._stops[this.getPointIndex(point)] = true;
        }
    }

    getPoint(code) {
        return this._codes[code];
    }

    addValue(point, amount) {
        if (point.x < this.min.x || point.x > this.max.x || point.y < this.min.y || point.y > this.max.y) {
            throw new Error("Point " + point + " was outside of bounds " + this.min + " " + this.max);
        }
        let index = this.getPointIndex(point);
        if (!this._data[index]) {
            this._data[index] = 0;
        }
        this._data[index] += amount;
    }

    exportToFile(filename) {
        var file = fs.createWriteStream(filename);
        file.write("lat,long,density,hasstop\n");
        for (var i = 0; i < this._data.length; i++) {
            var e = this._data[i] || 0;
            var point = this.getIndexPoint(i);
            file.write(point.x / Region.LAT_LONG_PRECISION + "," + point.y / Region.LAT_LONG_PRECISION + "," + e + "," + (!!this._stops[i] ? 1 : 0) + "\n");
        }
        file.end();
    }

    exportCellsToFile(filename) {
        var file = fs.createWriteStream(filename);
        var size = new Point(this.max.x - this.min.x, this.max.y - this.min.y);
        file.write("x,y,lat,long,density,hasstop\n");
        for (var i = 0; i < this._data.length; i++) {
            var e = this._data[i] || 0;
            var point = this.getIndexPoint(i);
            var x = Math.floor(i % size.x);
            var y = Math.floor(i / size.x);
            file.write(x + "," + y + "," + point.x / Region.LAT_LONG_PRECISION + "," + point.y / Region.LAT_LONG_PRECISION + "," + e + "," + (!!this._stops[i] ? 1 : 0) + "\n");
        }
        file.end();
    }

    exportEdgesToFile(filename, edges) {
        var file = fs.createWriteStream(filename);
        file.write("x1,y1,x2,y2\n");
        for (var i = 0; i < edges.length; i++) {
            var e = edges[i];
            var point1 = e.from;
            var point2 = e.to;
            file.write(point1.x + "," + point1.y + "," + point2.x + "," + point2.y + "\n");
        }
        file.end();
    }

    static visualizeFile(filename, outputFile, showDensity) {
        if (!showDensity) showDensity = false;
        var region = new Region(new Point(0, 1), new Point(0, 1));
        var parser = csvparse({delimiter: ','});
        var input = fs.createReadStream(filename);
        var transformer = transform((record, callback) => {
            if (record[0] != 'x') {
                var point = new Point(record[0], record[1]);
                var lat = record[2];
                var long = record[3];
                var e = parseFloat(record[4]);
                var stop = record[5] == 1;

                region.min = new Point(Math.min(region.min.x, point.x), Math.min(region.min.y, point.y));
                region.max = new Point(Math.max(region.max.x, point.x), Math.max(region.max.y, point.y));
                region.addValue(point, showDensity ? e : 1);
                if (stop) {
                    region.addStop(point);
                }
            }
            callback(null);
        }, () => {});

        input.pipe(parser).pipe(transformer).on('finish', function() {
            setImmediate(() => {
                new RegionVisualizer(region).render(outputFile);
            });
        });
    }

}

module.exports = Region;
