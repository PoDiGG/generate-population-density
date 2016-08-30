'use strict';

const Point = require('./Point.js');
const Region = require('./Region.js');

class RegionHelpers {

    static circleSurfaceToSquareRadius(surface) {
        return Math.sqrt(surface / Math.PI);
    };

    static haversineDistance(point1, point2) {
        var [lat1, long1] = Region.pointToLatLong(point1);
        var [lat2, long2] = Region.pointToLatLong(point2);

        var dLat = RegionHelpers.degreesToRadians(lat2 - lat1);
        var dLon = RegionHelpers.degreesToRadians(long2 - long1);

        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(RegionHelpers.degreesToRadians(lat1)) *
            Math.cos(RegionHelpers.degreesToRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        return 12742000 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); // In meters
    };

    static degreesToRadians(x) {
        return x * Math.PI / 180;
    };

    static iterateOverRegion(point_origin, distance, cb) {
        var x_step = [1, 1, -1, -1];
        var y_step = [1, -1, 1, -1];
        var loop_phase = 0;
        var point_loop = point_origin;
        cb(point_origin, 0);
        while (loop_phase < 4) {
            point_loop = new Point(point_loop.x + x_step[loop_phase], point_loop.y);
            var current_distance = RegionHelpers.haversineDistance(point_origin, point_loop);
            if (current_distance < distance) {
                // Avoid emitting the same points twice
                if (y_step[loop_phase] > 0 || point_loop.y != point_origin.y) {
                    cb(point_loop, current_distance);
                }
            } else {
                point_loop = new Point(point_origin.x, point_loop.y + y_step[loop_phase]);
                var current_distance = RegionHelpers.haversineDistance(point_origin, point_loop);
                if (current_distance < distance) {
                    // Avoid emitting the same points twice
                    if (x_step[loop_phase] > 0 || point_loop.x != point_origin.x) {
                        cb(point_loop, current_distance);
                    }
                } else {
                    loop_phase++;
                    point_loop = new Point(point_origin.x, point_origin.y);
                }
            }
        }
    };

}

module.exports = RegionHelpers;
