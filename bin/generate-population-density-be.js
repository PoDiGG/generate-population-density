'use strict';

const fs = require('fs');
const csvparse = require('csv-parse');
const transform = require('stream-transform');

const Point = require('../lib/Point.js');
const Region = require('../lib/Region.js');
const RegionHelpers = require('../lib/RegionHelpers.js');
const RegionVisualizer = require('../lib/RegionVisualizer.js');

var basepoint = Region.latLongToPoint(50, 4);
var testpoint = new Point(basepoint.x + 1, basepoint.y + 1);
console.log("One degree equals " + RegionHelpers.haversineDistance(basepoint, testpoint) / 1000 + " km"); // TODO

function consumeFile(filename, consumer, delimiter) {
    return new Promise((resolve, reject) => {
        var parser = csvparse({delimiter: delimiter || ','});
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

var postalToNis = [];
function postalCodeToNis(postalCode) {
    return postalToNis[postalCode];
}

// Read postal code data
function prepareData() {
    return consumeFile('input_data/postalcodes.csv', (record) => {
        var nis = record[0];
        var postal = record[1];
        postalToNis[postal] = nis;
    }, ';');
}

// Determine the bounds of our country
function getBounds() {
    var min = new Point(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    var max = new Point(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);

    return consumeFile('input_data/towns.tsv', (record) => {
        var point = Region.latLongToPoint(record[9], record[10]);
        min = new Point(Math.min(min.x, point.x), Math.min(min.y, point.y));
        max = new Point(Math.max(max.x, point.x), Math.max(max.y, point.y));
    }, '\t').then(() => { return { min: min, max: max } });
}

// Add the NIS codes (translated from postal codes) to the appropriate cell in our region object
function addRegionCodes(min, max) {
    var region = new Region(new Point(min.x - Region.REGION_PADDING, min.y - Region.REGION_PADDING), new Point(max.x + Region.REGION_PADDING, max.y + Region.REGION_PADDING));

    return consumeFile('input_data/towns.tsv', (record) => {
        var point = Region.latLongToPoint(record[9], record[10]);
        region.addCode(point, postalCodeToNis(record[1]));
    }, '\t').then(() => region);
}

// Assign values to our region
function populateRegion(region) {
    postalToNis = null; // Memory cleanup.

    return consumeFile('input_data/population.csv', (record) => {
        var code = record[0];
        var pop = record[2];
        var size_ha = record[3];
        var point_origin = region.getPoint(code);

        // Calculate edge points of circle surrounding the town
        var circle_radius = RegionHelpers.circleSurfaceToSquareRadius(size_ha); // in meters

        // Determine all points in the circle and count them
        var count_scaled = 0;
        RegionHelpers.iterateOverRegion(point_origin, circle_radius, function(point_loop, current_distance) {
            count_scaled += ((circle_radius - current_distance) / circle_radius);
        });

        // Loop over all points in the circle and assign a value to them
        var pop_div_scaled = pop / count_scaled;
        RegionHelpers.iterateOverRegion(point_origin, circle_radius, function(point_loop, current_distance) {
            region.addValue(point_loop, pop_div_scaled * ((circle_radius - current_distance) / circle_radius));
        });
    }, ';').then(() => region);
}

// Add stops to region
function tagStops(region) {
    return consumeFile('input_data/stops.csv', (record) => {
        var id = record[0];
        var lat = record[2];
        var long = record[3];
        var point = Region.latLongToPoint(lat, long);
        region.addStop(point);
        try {
            region.addCode(point, "stop_" + id);
        } catch (e) {}
    }).then(() => region);
}

// Read trips
function addTrips(region) {
    var trips = [];
    var lastTripData = {};

    return consumeFile('input_data/stop_times.csv', (record) => {
        var tripId = record[0];
        var stopId = record[3];
        var sequence = record[4];
        if (stopId.indexOf(':') > 0) stopId = stopId.substr(0, stopId.indexOf(':'));
        if (!lastTripData[tripId]) {
            lastTripData[tripId] = { stopId: stopId, sequence: sequence, passed: [] };
        } else if (lastTripData[tripId].sequence < sequence && lastTripData[tripId].passed.indexOf(stopId) < 0) {
            var startStopId = lastTripData[tripId].stopId;
            var endStopId = stopId;
            var trip = { from: region.getPoint("stop_" + startStopId), to: region.getPoint("stop_" + endStopId) };
            if (trip.from && trip.to) {
                trips.push(trip);
            }
            lastTripData[tripId].stopId = stopId;
            lastTripData[tripId].sequence = sequence;
            lastTripData[tripId].passed.push(startStopId);
        }
    }).then(() => { return { region: region, trips: trips} });
}

// Run all the things
prepareData()
    .then(() => getBounds())
    .then(({ min, max }) => addRegionCodes(min, max))
    .then((region) => populateRegion(region))
    .then((region) => tagStops(region))
    .then((region) => addTrips(region))
    .then(({ region, trips }) => {
        new RegionVisualizer(region, trips).render();
        region.exportToFile("region.csv");
        region.exportCellsToFile("region_cells.csv");
    })
    .catch(function(error) {
        console.error(error.stack);
    });
