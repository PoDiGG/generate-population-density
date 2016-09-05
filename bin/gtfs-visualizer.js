'use strict';

const fs = require('fs');
const csvparse = require('csv-parse');
const transform = require('stream-transform');

const Region = require('../lib/Region.js');
const Point = require('../lib/Point.js');
const RegionVisualizer = require('../lib/RegionVisualizer.js');

if (process.argv.length < 3) {
    throw new Error('Expected the path to a GTFS directory as input argument');
}

var stop_times_filename = process.argv[2] + "/stop_times.txt";
var stops_filename = process.argv[2] + "/stops.txt";

var min = new Point(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
var max = new Point(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
var region;
var trips = [];

function consumeFile(filename, consumer) {
    return new Promise((resolve, reject) => {
        var parser = csvparse({delimiter: ','});
        var input = fs.createReadStream(filename);
        var first = true;
        var transformer = transform((record, callback) => {
            if (first) {
                first = false;
            } else {
                consumer(record);
            }
            callback(null);
        }, reject);

        input.pipe(parser).pipe(transformer).on('finish', resolve);
    });
}

function consumeStops(consumer) {
    return consumeFile(stops_filename, consumer);
}

function determineStopMinMax() {
    return consumeStops((record) => {
        var lat = parseFloat(record[2]);
        var long = parseFloat(record[3]);
        var point = Region.latLongToPoint(lat, long);
        min = new Point(Math.min(min.x, point.x), Math.min(min.y, point.y));
        max = new Point(Math.max(max.x, point.x), Math.max(max.y, point.y));
    });
}

function populateRegionWithStops() {
    return consumeStops((record) => {
        var stopId = record[0];
        var lat = parseFloat(record[2]);
        var long = parseFloat(record[3]);
        var type = parseInt(record[6]);
        if (type == 1) {
            var point = Region.latLongToPoint(lat, long);
            region.addStop(point);
            region.addCode(point, stopId);
        }
    });
}

function populateRegionWithRoutes() {
    var lastTripData = {};
    return consumeFile(stop_times_filename, (record) => {
        var tripId = record[0];
        var stopId = record[3];
        var sequence = record[4];
        if (stopId.indexOf(':') > 0) stopId = stopId.substr(0, stopId.indexOf(':'));
        if (!lastTripData[tripId]) {
            lastTripData[tripId] = { stopId: stopId, sequence: sequence, passed: [] };
        } else if (lastTripData[tripId].sequence < sequence && lastTripData[tripId].passed.indexOf(stopId) < 0) {
            var startStopId = lastTripData[tripId].stopId;
            var endStopId = stopId;
            var trip = { from: region.getPoint(startStopId), to: region.getPoint(endStopId) };
            if (trip.from && trip.to) {
                trips.push(trip);
            }
            lastTripData[tripId].stopId = stopId;
            lastTripData[tripId].sequence = sequence;
            lastTripData[tripId].passed.push(startStopId);
        }
    });
}

function initRegion() {
    return new Promise((resolve, reject) => {
        try {
            region = new Region(min, max);
        } catch (e) {
            reject(e);
        }
        resolve();
    });
}

determineStopMinMax()
    .then(() => initRegion())
    .then(() => populateRegionWithStops())
    .then(() => populateRegionWithRoutes())
    .then(() => {
        console.log("done " + region);
        new RegionVisualizer(region, trips).render("belgiantrips.png");
    })
    .catch(function(error) {
        console.error(error.stack);
    });