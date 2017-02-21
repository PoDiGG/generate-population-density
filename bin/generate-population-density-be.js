'use strict';

const fs = require('fs');
const csvparse = require('csv-parse');
const transform = require('stream-transform');
const shapefile = require('shapefile');
const proj4 = require('proj4');

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
        var colnames = null;
        var transformer = transform((record, callback) => {
            if (first) {
                first = false;
                colnames = record;
            } else {
                consumer(record, colnames.reduce((acc, colname, i) => {
                    acc[colname] = record[i];
                    return acc;
                }, {}));
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

function makeRegion(min, max) {
    return new Promise((resolve, reject) => {
        var region = new Region(new Point(min.x - Region.REGION_PADDING, min.y - Region.REGION_PADDING), new Point(max.x + Region.REGION_PADDING, max.y + Region.REGION_PADDING));
        resolve(region);
    });
}

// Add the NIS codes (translated from postal codes) to the appropriate cell in our region object
function addRegionCodes(min, max) {
    console.log("adding region codes...");
    return makeRegion(min, max)
      .then((region) => {
          return consumeFile('input_data/towns.tsv', (record) => {
              var point = Region.latLongToPoint(record[9], record[10]);
              region.addCode(point, postalCodeToNis(record[1]));
          }, '\t').then(() => region)
      });
}

// Assign values to our region
function populateRegion(region) {
    console.log("populating region...");
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
function tagStops(region, file) {
    console.log("tagging stops...");
    var cnt = 0;
    return consumeFile(file, (record, recordNamed) => {
        var id = recordNamed.stop_id;
        if (id.indexOf(':') > 4) id = id.substr(0, id.indexOf(':'));
        var lat = recordNamed.stop_lat;
        var long = recordNamed.stop_lon;
        var point = Region.latLongToPoint(lat, long);
        region.addStop(point);
        try {
            region.addCode(point, "stop_" + id);
            cnt++;
        } catch (e) {
        }
    }).then(() => { console.log("tagged: " + cnt); return region;});
}

// Read trips
function addTrips(region, trips, file) {
    console.log("adding trips...");
    if (!trips) trips = [];
    var lastTripData = {};

    return consumeFile(file, (record, recordNamed) => {
        var tripId = recordNamed.trip_id;
        var arrivalTime = recordNamed.arrival_time;
        var departureTime = recordNamed.departure_time;
        var stopId = recordNamed.stop_id;
        var sequence = recordNamed.stop_sequence;
        if (stopId.indexOf(':') > 4) stopId = stopId.substr(0, stopId.indexOf(':'));
        if (!lastTripData[tripId]) {
            lastTripData[tripId] = { stopId: stopId, sequence: sequence, passed: [] };
        } else if (lastTripData[tripId].sequence < sequence && lastTripData[tripId].passed.indexOf(stopId) < 0) {
            var startStopId = lastTripData[tripId].stopId;
            var endStopId = stopId;
            var trip = {
                tripId: tripId,
                from: region.getPoint("stop_" + startStopId),
                to: region.getPoint("stop_" + endStopId),
                arrivalTime: arrivalTime,
                departureTime: departureTime
            };
            if (trip.from && trip.to) {
                trips.push(trip);
            }
            lastTripData[tripId].stopId = stopId;
            lastTripData[tripId].sequence = sequence;
            lastTripData[tripId].passed.push(startStopId);
        }
    }).then(() => { return { region: region, trips: trips} });
}

function exportData(region, trips) {
    console.log("exporting...");
    new RegionVisualizer(region, trips).render();
    region.exportToFile("region.csv");
    region.exportCellsToFile("region_cells.csv");
    region.exportEdgesToFile("region_edges.csv", trips);
}

function readShapeFile(shapefile_path, cb) {
    var projection_from = fs.readFileSync(shapefile_path + '.prj', 'utf8');
    var projection_to = '+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees';
    var popData = {};
    return consumeFile('input_data_train_nl/shapefile-nl/GEOSTAT_grid_POP_1K_NL_2012.csv', (record) => {
        popData[record[0]] = record[5];
    }, ';')
        .then(() => shapefile.open(shapefile_path))
        .then(source => source.read()
        .then(function log(result) {
            if (result.done) return;
            //console.log(result.value.geometry.coordinates[0]);
            if (result.value.properties) {
                var cellId = result.value.properties.GRD_NEWID;
                //var scaledValue = result.value.properties.ind / result.value.geometry.coordinates[0].length;
                var coordinates = result.value.geometry.type === 'Polygon' ? result.value.geometry.coordinates[0] : result.value.geometry.coordinates[0][0];
                var scaledValue = (popData[cellId] || 0) / coordinates.length;
                for (var coord of coordinates) {
                    var out = proj4(projection_from, projection_to, coord);
                    var lat = parseFloat(out[1]);
                    var lon = parseFloat(out[0]);

                    if (lat && lon) {
                        cb(lat, lon, scaledValue);
                    } else {
                        console.log(result.value.geometry); // TODO
                    }
                }
            }
            // TODO: problem: part of France is skipped (corrupt dataset?)
            //if (temp_counter++ === 10000) return;// TODO
            return source.read().then(log);
        }))
      .catch(error => console.error(error.stack));
}

function populateRegionFromShapefile(shapefile_path, region) {
    return readShapeFile(shapefile_path, (lat, lon, value) => {
        var point = Region.latLongToPoint(lat, lon);
        region.addValue(point, value);
    }).then(() => region);
}

if (process.argv.length < 3) {
    throw new Error('Please provide a parameter to either generate \'bus\' or \'train\' data.');
}
var type = process.argv[2];
if (type === 'bus') {
    // Run all the things
    prepareData()
      .then(() => getBounds())
      .then(({ min, max }) => addRegionCodes(min, max))
      .then((region) => populateRegion(region))
      .then((region) => tagStops(region, 'input_data_bus/stops_delijn.csv'))
      .then((region) => tagStops(region, 'input_data_bus/stops_tec.csv'))
      .then((region) => tagStops(region, 'input_data_bus/stops_mivb.csv'))
      .then((region) => addTrips(region, null, 'input_data_bus/stop_times_tec.csv'))
      .then(({ region, trips }) => addTrips(region, trips, 'input_data_bus/stop_times_delijn.csv'))
      .then(({ region, trips }) => addTrips(region, trips, 'input_data_bus/stop_times_mivb.csv'))
      .then(({ region, trips }) => exportData(region, trips))
      .catch(function(error) {
          console.error(error.stack);
      });
} else if (type === 'train') {
    // Run all the things
    prepareData()
      .then(() => getBounds())
      .then(({ min, max }) => addRegionCodes(min, max))
      .then((region) => populateRegion(region))
      .then((region) => tagStops(region, 'input_data_train/stops.csv'))
      .then((region) => addTrips(region, null, 'input_data_train/stop_times.csv'))
      .then(({ region, trips }) => exportData(region, trips))
      .catch(function(error) {
          console.error(error.stack);
      });
} else if (type === 'train_nl') {
    // Run all the things
    var min = new Point(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    var max = new Point(0, 0);
    //var shapefile_path = 'input_data_train_fr/shapefile-fr/Grid_ETRS89_LAEA_FR_1K';
    var shapefile_path = 'input_data_train_nl/shapefile-nl/Grid_ETRS89_LAEA_NL_1K';
    readShapeFile(shapefile_path, (lat, lon, value) => {
        var point = Region.latLongToPoint(lat, lon);
        min.x = Math.min(min.x, point.x);
        max.x = Math.max(max.x, point.x);
        min.y = Math.min(min.y, point.y);
        max.y = Math.max(max.y, point.y);
    })
      .then(() => makeRegion(min, max))
      .then((region) => populateRegionFromShapefile(shapefile_path, region))
      .then((region) => tagStops(region, 'input_data_train_nl/stops.csv'))
      .then((region) => addTrips(region, null, 'input_data_train_nl/stop_times.csv'))
      .then(({ region, trips }) => exportData(region, trips))
      .catch(function(error) {
          console.error(error.stack);
      });
} else {
    throw new Error('No generator for the type \'' + type + '\' exists.');
}
