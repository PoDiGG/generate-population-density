'use strict';

const fs = require('fs');
const csvparse = require('csv-parse');
const transform = require('stream-transform');

const Point = require('../lib/Point.js');
const Region = require('../lib/Region.js');
const RegionVisualizer = require('../lib/RegionVisualizer.js');

const LAT_LONG_PRECISION = 100;
const REGION_PADDING = 1 * LAT_LONG_PRECISION;

var postalToNis = [];

var basepoint = latLongToPoint(50, 4);
var testpoint = new Point(basepoint.x + 1, basepoint.y + 1);
//var testpoint = latLongToPoint(51, 4);
console.log("One degree equals " + haversineDistance(basepoint, testpoint) / 1000 + " km"); // TODO

function latLongToPoint(lat, long) {
    return new Point(lat * LAT_LONG_PRECISION | 0, long * LAT_LONG_PRECISION | 0);
}

function pointToLatLong(point) {
    return [ point.x / LAT_LONG_PRECISION, point.y / LAT_LONG_PRECISION ];
}

prepareData();
function prepareData() {
    var parser = csvparse({delimiter: ';'});
    var input = fs.createReadStream('input_data/postalcodes.csv');
    var transformer = transform((record, callback) => {
        var nis = record[0];
        var postal = record[1];
        postalToNis[postal] = nis;
        callback(null);
    }, () => {});

    input.pipe(parser).pipe(transformer).on('finish', function() {
        setImmediate(() => getBounds());
    });
}

function postalCodeToNis(postalCode) {
    return postalToNis[postalCode];
}

// Determine the bounds of our country
function getBounds() {
    var min = new Point(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    var max = new Point(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);

    var parser = csvparse({delimiter: '\t'});
    var input = fs.createReadStream('input_data/towns.tsv');
    var transformer = transform((record, callback) => {
        var point = latLongToPoint(record[9], record[10]);
        min = new Point(Math.min(min.x, point.x), Math.min(min.y, point.y));
        max = new Point(Math.max(max.x, point.x), Math.max(max.y, point.y));
        callback(null);
    }, () => {});

    input.pipe(parser).pipe(transformer).on('finish', function() {
        setImmediate(() => addRegionCodes(min, max));
    });
}

// Add the NIS codes (translated from postal codes) to the appropriate cell in our region object
function addRegionCodes(min, max) {
    var region = new Region(new Point(min.x - REGION_PADDING, min.y - REGION_PADDING), new Point(max.x + REGION_PADDING, max.y + REGION_PADDING));

    var parser = csvparse({delimiter: '\t'})
    var input = fs.createReadStream('input_data/towns.tsv');
    var transformer = transform((record, callback) => {
        var point = latLongToPoint(record[9], record[10]);
        region.addCode(point, postalCodeToNis(record[1]));
        callback(null);
    }, () => {});

    input.pipe(parser).pipe(transformer).on('finish', function() {
        setImmediate(() => populateRegion(region));
    });
}

function circleSurfaceToSquareRadius(surface) {
    return Math.sqrt(surface / Math.PI);
}

function haversineDistance(point1, point2) {
    // TODO: use destructors: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment
    var latlong1 = pointToLatLong(point1);
    var lat1 = latlong1[0];
    var long1 = latlong1[1];
    var latlong2 = pointToLatLong(point2);
    var lat2 = latlong2[0];
    var long2 = latlong2[1];

    var dLat = degreesToRadians(lat2 - lat1);
    var dLon = degreesToRadians(long2 - long1);

    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(degreesToRadians(lat1)) *
        Math.cos(degreesToRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    return 12742000 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); // In meters
}

function degreesToRadians(x) {
    return x * Math.PI / 180;
}

function iterateOverRegion(point_origin, distance, cb) {
    var x_step = [1, 1, -1, -1];
    var y_step = [1, -1, 1, -1];
    var loop_phase = 0;
    var point_loop = point_origin;
    cb(point_origin);
    while (loop_phase < 4) {
        point_loop = new Point(point_loop.x + x_step[loop_phase], point_loop.y);
        if (haversineDistance(point_origin, point_loop) < distance) {
            // Avoid emitting the same points twice
            if (y_step[loop_phase] > 0 || point_loop.y != point_origin.y) {
                cb(point_loop);
            }
        } else {
            point_loop = new Point(point_origin.x, point_loop.y + y_step[loop_phase]);
            if (haversineDistance(point_origin, point_loop) < distance) {
                // Avoid emitting the same points twice
                if (x_step[loop_phase] > 0 || point_loop.x != point_origin.x) {
                    cb(point_loop);
                }
            } else {
                loop_phase++;
                point_loop = new Point(point_origin.x, point_origin.y);
            }
        }
    }
}

// Assign values to our region
function populateRegion(region) {
    postalToNis = null; // Memory cleanup.
    var parser = csvparse({delimiter: ';'});
    var input = fs.createReadStream('input_data/population.csv');
    var transformer = transform((record, callback) => {
        var code = record[0];
        if (code !== 'NIS-CODE') {
            var pop = record[2];
            var size_ha = record[3];
            var point_origin = region.getPoint(code);

            // Calculate edge points of circle surrounding the town
            var circle_radius = circleSurfaceToSquareRadius(size_ha); // in meters

            // Determine all points in the circle and count them
            var count = 0;
            iterateOverRegion(point_origin, circle_radius, function() {
                count++;
            });

            // Loop over all points in the circle and assign a value to them
            var pop_div = pop / count;
            iterateOverRegion(point_origin, circle_radius, function(point_loop) {
                region.addValue(point_loop, pop_div);
            });
        }
        callback(null);
    }, () => {});

    input.pipe(parser).pipe(transformer).on('finish', function() {
        setImmediate(() => {
            // TODO
        });
    });
}
