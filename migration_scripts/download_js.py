import os
import requests

urls = [
	"https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.9.3/Chart.bundle.min.js",
	"https://unpkg.com/leaflet.gridlayer.googlemutant@latest/dist/Leaflet.GoogleMutant.js",
	"https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css",
	"https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css",
	"https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css",
	"https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js",
	"https://maxcdn.bootstrapcdn.com/font-awesome/4.4.0/css/font-awesome.min.css",
	"https://cdnjs.cloudflare.com/ajax/libs/jquery-csv/1.0.11/jquery.csv.min.js",
	"https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js",
	"https://unpkg.com/@mapbox/leaflet-pip@latest/leaflet-pip.js",
	"https://cdnjs.cloudflare.com/ajax/libs/leaflet-contextmenu/1.4.0/leaflet.contextmenu.css",
	"https://cdnjs.cloudflare.com/ajax/libs/leaflet-contextmenu/1.4.0/leaflet.contextmenu.js",
	"https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js",
	"https://unpkg.com/leaflet@1.6.0/dist/leaflet.js",
	"https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js",
	"https://cdnjs.cloudflare.com/ajax/libs/plotly.js/2.24.1/plotly.min.js",
	"https://cdnjs.cloudflare.com/ajax/libs/regression/2.0.1/regression.js",
	"https://cdn.jsdelivr.net/npm/@splidejs/splide@latest/dist/css/splide.min.css",
	"https://cdn.jsdelivr.net/npm/@splidejs/splide@latest/dist/js/splide.min.js",
	"https://releases.transloadit.com/uppy/v3.3.1/uppy.min.css",
	"https://releases.transloadit.com/uppy/v3.3.1/uppy.min.js"
]

for url in urls:
    file_Path = 'static/js/'+url.split('/')[-1]
    if not os.path.isfile(file_Path):
        response = requests.get(url)
        if response.status_code == 200:
            with open(file_Path, 'wb') as file:
                file.write(response.content)