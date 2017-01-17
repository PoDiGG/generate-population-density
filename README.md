# Population density file generator

`bin/generate-population-density-be.js` creates 4 files:
* `region_cells.csv`: CSV-formatted
cells of the Belgium region where each cell contains the
population density and indicates whether or not it has a stop.
This file can be used as region input to PoDiGG
* `region_edges.csv`: A list of all trips from each cell to each cell.
This file should be used during PoDiGG evaluation.
* `region.csv`: Same as `region_cells.csv` but without virtual `x` and `y` cell coordinates.
* `region.csv`: Visualization of the region. Population distribution
levels are indicated for each cell with a color between
white, red and black (going from low to high). Green dots indicate stops.

This tool accepts the following parameters `bus`, `train` or `train_nl`,
which respectively creates region files for the Belgian bus and railway company and the Dutch railway company.

## Input data

`input_data.zip` must be unzipped before the following files can be used.

### Input data BE
* `input_data/population.csv`: Population+size+density of Belgian towns: http://data.gov.be/en/node/8176
* `input_data/postalcodes.tsv`: Postal codes of all Belgian towns with their Dutch name and gewest. http://data.gov.be/en/node/8614
* `input_data/towns.csv`: Location (long,lat) of Belgian cities: http://download.geonames.org/export/zip/

### Input data train BE
* `input_data_train/stop.csv`: Stops file from [NMBS GTFS dataset](http://gtfs.irail.be/nmbs)
* `input_data_train/stop_times.csv`: Stop_times file from [NMBS GTFS dataset](http://gtfs.irail.be/nmbs)

### Input data bus BE 
* `input_data_bus/stops_deliin.csv`: Stops file from [De Lijn GTFS dataset](http://gtfs.irail.be/de-lijn/de_lijn-gtfs.zip)
* `input_data_bus/stop_mivb.csv`: Stops file from [MIVB GTFS dataset](http://gtfs.irail.be/mivb/mivb-gtfs.zip)
* `input_data_bus/stop_tec.csv`: Stops file from [TEC GTFS dataset](http://gtfs.irail.be/tec/tec-gtfs.zip)
* `input_data_bus/stop_times_delijn.csv`: Stop_times file from [De Lijn GTFS dataset](http://gtfs.irail.be/de-lijn/de_lijn-gtfs.zip)
* `input_data_bus/stop_times_mivb.csv`: Stop_times file from [MIVB GTFS dataset](http://gtfs.irail.be/mivb/mivb-gtfs.zip)
* `input_data_bus/stop_times_tec.csv`: Stop_times file from [TEC GTFS dataset](http://gtfs.irail.be/tec/tec-gtfs.zip)

### Input data NL
* `input_data_train_nl/Grid_ETRS89_LAEA_NL_1K_*`: Netherlands shapefile: http://www.efgs.info/data/
* `input_data_train_nl/GEOSTAT_grid_POP_1K_NL_2012.csv`: Population per cell in shapefile: http://www.efgs.info/data/national/

### Input data train NL 
* `input_data_train_nl/stop.csv`: Stops file from [NS GTFS dataset](http://www.gtfs-data-exchange.com/agency/ns/)
* `input_data_train_nl/stop_times.csv`: Stop_times file from [NS GTFS dataset](http://www.gtfs-data-exchange.com/agency/ns/)

# License
The PoDiGG generator is written by [Ruben Taelman](http://rubensworks.net/).

This code is copyrighted by [Ghent University – imec](http://idlab.ugent.be/)
and released under the [MIT license](http://opensource.org/licenses/MIT).