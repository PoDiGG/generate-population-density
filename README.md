Population density dataset creator for Belgium.

This tool creates 4 files:
* `region_cells.csv`: CSV-formatted
cells of the Belgium region where each cell contains the
population density and indicates whether or not it has a stop.
* `region_edges.csv`: A list of all trips from each cell to each cell.
* `region.csv`: Same as `region_cells.csv` but without virtual `x` and `y` cell coordinates.
* `region.csv`: Visualization of the region. Population distribution
levels are indicated for each cell with a color between
white, red and black (going from low to high). Green dots indicate stops.

Input data:
* `population.csv`: Population+size+density of Belgian towns: http://data.gov.be/en/node/8176
* `postalcodes.tsv`: Postal codes of all Belgian towns with their Dutch name and gewest. http://data.gov.be/en/node/8614
* `towns.csv`: Location (long,lat) of Belgian cities: http://download.geonames.org/export/zip/

Input data train: 
* `stop.csv`: Stops file from [NMBS GTFS dataset](http://gtfs.irail.be/nmbs)
* `stop_times_delijn.csv`: Stop_times file from [NMBS GTFS dataset](http://gtfs.irail.be/nmbs)

Input data bus: 
* `stop.csv`: Stops file from [De Lijn GTFS dataset](http://gtfs.irail.be/de-lijn/de_lijn-gtfs.zip)
* `stop_2.csv`: Stops file from [MIVB GTFS dataset](http://gtfs.irail.be/mivb/mivb-gtfs.zip)
* `stop_3.csv`: Stops file from [TEC GTFS dataset](http://gtfs.irail.be/tec/tec-gtfs.zip)
* `stop_times_delijn.csv`: Stop_times file from [De Lijn GTFS dataset](http://gtfs.irail.be/de-lijn/de_lijn-gtfs.zip)
* `stop_times_tec.csv`: Stop_times file from [TEC GTFS dataset](http://gtfs.irail.be/tec/tec-gtfs.zip)
* `stop_times_mivb.csv`: Stop_times file from [MIVB GTFS dataset](http://gtfs.irail.be/mivb/mivb-gtfs.zip)
