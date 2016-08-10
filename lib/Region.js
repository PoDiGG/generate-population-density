'use strict';

class Region {
    constructor(min, max) {
        this.min = min;
        this.max = max;
        this._data  = new Array((this.max.x - this.min.x) * (this.max.y - this.min.y));
        console.log("region cells: " + this._data.length); // TODO
        this._codes = [];
    }

    getPointIndex(point) {
        return (point.x - this.min.x) + (this.max.x - this.min.x) * (point.y - this.min.y);
    }

    addCode(point, code) {
        if (point.x < this.min.x || point.x > this.max.x || point.y < this.min.y || point.y > this.max.y) {
            throw new Error("Point " + point + " was outside of bounds " + this.min + " " + this.max);
        }
        this._codes[code] = point;
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
}

module.exports = Region;
