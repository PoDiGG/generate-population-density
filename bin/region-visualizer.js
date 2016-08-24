'use strict';

const Region = require('../lib/Region.js');

if (process.argv.length < 4) {
    throw new Error('Expected source region file and target image file path as input arguments.');
}
Region.visualizeFile(process.argv[2], process.argv[3], process.argv.length > 4 ? process.argv[4] : null);
