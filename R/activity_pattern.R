# Copyright 2023

# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at

# http://www.apache.org/licenses/LICENSE-2.0

# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
library(overlap)
library(activity)
library(lubridate)
library(ggplot2)
library(solartime)

calculate_activity_pattern <- function(data, file_name, species, centre, unit, time, overlap, lat, lng, utc_offset_hours,tz) {
  # Calculate activity pattern
  dat <- data
  file_name <- paste0(file_name, ".JPG")
  jpeg(file = file_name, quality = 100, width = 800, height = 800, units = "px", pointsize = 16)

  max_result <- 0

  if (overlap == 'true' && length(species) == 2){
    dat1 <- dat[dat$species == species[1],]
    dat2 <- dat[dat$species == species[2],]

    if (time == "solar"){
      pos.time1 <- as.POSIXct(dat1$timestamp)
      time_solar1 <- solartime(pos.time1,  lat, lng, utc_offset_hours)
      time.rad1 <- time_solar1$solar

      pos.time2 <- as.POSIXct(dat2$timestamp)
      time_solar2 <- solartime(pos.time2,  lat, lng, utc_offset_hours)
      time.rad2 <- time_solar2$solar
    }
    else{
      pos.time1 <- as.POSIXct(dat1$timestamp)
      time.prop1 <- gettime(pos.time1, scale = "proportion")    
      time.rad1 <- gettime(pos.time1, scale = "radian")

      pos.time2 <- as.POSIXct(dat2$timestamp)
      time.prop2 <- gettime(pos.time2, scale = "proportion")    
      time.rad2 <- gettime(pos.time2, scale = "radian")
    }

    if (centre == 'night') {
      overlap_centre <- "midnight"
    }
    else{
      overlap_centre <- "noon"
    }

    line_types <- c(1, 2)

    e = overlapEst(time.rad1, time.rad2, kmax = 3, adjust=c(0.8, 1, 4), n.grid = 128,
            type=c("all", "Dhat1", "Dhat4", "Dhat5"))

    average_e <- mean(e)

    overlapPlot(time.rad1, time.rad2, xscale = 24, xcenter = overlap_centre,
              linetype = c(1, 2), linecol = c("black", "black"), linewidth = c(1, 1),
              olapcol = "lightgrey", rug=FALSE, extend=NULL,
              n.grid = 128, kmax = 3, adjust = 1, main = paste("Overlap Estimate:", round(average_e, 2)))

    sunset = c()
    sunrise = c()
    for (i in seq_along(dat$timestamp)) {
      rise <- computeSunriseHour(as.Date(dat$timestamp[i]), lat, lng, utc_offset_hours)
      set <- computeSunsetHour(as.Date(dat$timestamp[i]), lat, lng, utc_offset_hours)

      sunrise <- append(sunrise, rise)
      sunset <- append(sunset, set)

    } 

    sunrise_avg <- mean(sunrise)
    sunset_avg <- mean(sunset)

    if (centre == 'night') {
      sunrise_avg <- sunrise_avg
      sunset_avg <- sunset_avg - 24
    }

    abline(v = sunrise_avg, col = "red", lty = 1)
    abline(v = sunset_avg, col = "red", lty = 1)

    legend("topright", legend = species, lty = line_types, cex = 0.8)
  }
  else{

    for (i in seq_along(species)) {
      s <- species[i]
      dat_s <- dat[dat$species == s,]

      if (time == "solar") {
        time_solar <- solartime(dat_s$timestamp, lat, lng, utc_offset_hours)
        time.rad <- time_solar$solar
      } else {
        pos.time <- as.POSIXct(dat_s$timestamp)
        time.prop <- gettime(pos.time, scale = "proportion")
        time.rad <- gettime(pos.time, scale = "radian")
      }

      result <- fitact(time.rad)

      if (i == 1) {
        plot(result, yunit = unit, data='none', centre = centre, col = 'black', tline = list(lty = i))
      } else {
        plot(result, yunit = unit, data='none', centre = centre, add = TRUE, col = 'black', tline = list(lty = i))
      }
      
    }

    sunset = c()
    sunrise = c()
    for (i in seq_along(dat$timestamp)) {
      rise <- computeSunriseHour(as.Date(dat$timestamp[i]), lat, lng, utc_offset_hours)
      set <- computeSunsetHour(as.Date(dat$timestamp[i]), lat, lng, utc_offset_hours)

      sunrise <- append(sunrise, rise)
      sunset <- append(sunset, set)

    } 

    sunrise_avg <- mean(sunrise)
    sunset_avg <- mean(sunset)

    if (centre == 'night') {
      sunrise_avg <- sunrise_avg
      sunset_avg <- sunset_avg - 24
    }

    abline(v = sunrise_avg, col = "red", lty = 1)
    abline(v = sunset_avg, col = "red", lty = 1)

    legend("topright", legend = species, col = "black", lty = seq_along(species), cex = 0.8)
  }

  dev.off()
  
  return(file_name)

}


get_activity_from_csv <- function(){
  # Update the parameters below for your use case

  # CSV file path
  filename <- 'data.csv'

  # Read csv file
  species_data <- read.csv(filename, header = TRUE, sep = ",")

  # Convert to R dataframe
  species_data <- as.data.frame(species_data)

  # Image filename to save (without extension)
  file_name <- 'activity_pattern'

  # Species 
  species <- c('Antelope', 'Leopard', 'Lion')

  # Centre (day or night)
  centre <- 'day'

  # Unit (density or frequency)
  unit <- 'density'

  # Time (solar or clock)
  time <- 'clock'

  # Overlap (true or false)
  overlap <- 'false'

  # Latitude
  lat <- -25.746

  # Longitude
  lng <- 28.187

  # UTC offset hours with sign (South Africa is UTC+2) 
  utc_offset_hours <- 2

  # Timezone
  tz <- 'Africa/Johannesburg'

  # Calculate activity pattern
  image_file_name <- calculate_activity_pattern(species_data, file_name, species, centre, unit, time, overlap, lat, lng, utc_offset_hours, tz)

  return(image_file_name)
}
