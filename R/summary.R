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

# library(tidyverse) # issue
# library(ggplot2)
# library(lubridate)
# library(ggrepel)
# library(ggpubr) # issue
library(vegan) # issue
# library(plotly) # issue
# library(ggpmisc) # issue
# library(nicheROVER)

calculate_summary_indexes <- function(species_data) {
    # Shannon diversity Index, Hill numbers, Simpson's index, and Pielou's evenness

    species_pop = species_data$count

    # Shannon diversity Index
    shannon_index = diversity(species_pop, index = "shannon")

    # Simpson's index
    # simpsons_index = simpson.unb(species_pop)
    simpsons_index = diversity(species_pop, index = "simpson")

    # Hill numbers
    hill_number = diversity(species_pop, index = "invsimpson")
    # hill_number =  simpson.unb(species_pop, inverse = TRUE)

    species_pop = species_pop[species_pop != 0]

    # Pielou's evenness
    pielous_evenness = shannon_index/log(length(species_pop))

    summary_indexes <- list(shannon_index = shannon_index,
                            simpsons_index = simpsons_index,
                            hill_number = hill_number,
                            pielous_evenness = pielous_evenness,
                            species_richness = length(species_pop))
    print(summary_indexes)
    return(summary_indexes)

}
