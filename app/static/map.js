// var locations = [
//   ["LOCATION_1", 11.8166, 122.0942],
//   ["LOCATION_2", 11.9804, 121.9189],
//   ["LOCATION_3", 10.7202, 122.5621],
//   ["LOCATION_4", 11.3889, 122.6277],
//   ["LOCATION_5", 10.5929, 122.6325]
// ];

// let latSum = 0;
// let longSum = 0;
// locations.forEach((item, i) => {
//   console.log(item)
//   console.log(item[1])
//   latSum += Number(item[1]);
//   longSum += Number(item[2]);
// });
// const latAverage = latSum / locations.length;
// const longAverage = longSum / locations.length;

var map = L.map('map')//.setView([latAverage, longAverage], 8);
mapLink =
  '<a href="http://openstreetmap.org">OpenStreetMap</a>';
L.tileLayer(
  'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; ' + mapLink + ' Contributors',
    maxZoom: 18,
  }).addTo(map);

var bounds = new L.LatLngBounds();

for (var i = 0; i < locations.length; i++) {
  marker = new L.marker([locations[i][1], locations[i][2]])
    .bindPopup(locations[i][0])
    .addTo(map);
  bounds.extend(marker.getLatLng());
}
map.fitBounds(bounds);
const currentZoom = map.getZoom()
if ( currentZoom > 0 ) {
  if (currentZoom > 4) {
    map.setZoom(4);
  } else {
    map.setZoom(currentZoom - 1);
  }
}
