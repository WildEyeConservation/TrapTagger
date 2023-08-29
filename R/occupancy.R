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

library(camtrapR)
library(unmarked)
library(AICcmodavg)
library(lubridate)
library(ggplot2)

# Global variables
best_model <- NULL
best_model_cov_names <- NULL
site_cov_names <- NULL
det_cov_names <- NULL
all_covs <- NULL
species <- NULL
model_sel_name <- NULL
cov_options <- NULL

occupancy <- function(detection_df, site_df, setup_col, retrieval_col, station_col, window, site_cov, det_cov, all_covs, species, cov_options){
    # Calculate occupancy for a species using the detection and site dataframes
    
    window <- as.numeric(window)

    # Get camera operation
    cameras <- site_df
    cam_op <- cameraOperation(
        CTtable = cameras,
        setupCol = setup_col,
        retrievalCol = retrieval_col,
        stationCol = station_col,
        dateFormat = 'ymd',
        hasProblems  = FALSE)

    # Get detection history
    DH <- detectionHistory(
        recordTable = detection_df,
        camOp = cam_op, 
        stationCol = station_col,
        speciesCol = "species",
        recordDateTimeCol = 'timestamp',
        species = species,
        occasionLength = window, 
        day1 = 'station',
        datesAsOccasionNames = F,
        includeEffort = F,
        scaleEffort = F
    )

    # Naive occupancy
    total_sites <- nrow(cameras)
    sites_with_species <- length(unique(detection_df[,station_col]))
    naive_occupancy <- sites_with_species/total_sites

    cov_options <- cov_options
    # Get site covariates
    site_cov <- site_cov
    site_cov_names <- names(site_cov)
    site_cov_names <- site_cov_names[site_cov_names != station_col]

    for (site_cov_name in site_cov_names){
        if (cov_options[site_cov_name,'type'] == 'Numeric'){
            site_cov[,site_cov_name] <- as.numeric(site_cov[,site_cov_name])
            if (cov_options[site_cov_name, 'scale'] == 'Yes'){
                site_cov[,site_cov_name] <- scale(site_cov[,site_cov_name])
            }
        }
        else{
            site_cov[,site_cov_name] <- as.factor(site_cov[,site_cov_name])
        }
    }

    # Get detection covariates
    det_cov <- det_cov
    det_cov_names <- names(det_cov)
    det_cov_names <- det_cov_names[det_cov_names != station_col]

    for (det_cov_name in det_cov_names){
        if (cov_options[det_cov_name,'type'] == 'Numeric'){ # if numeric
            det_cov[,det_cov_name] <- as.numeric(det_cov[,det_cov_name])
            if (cov_options[det_cov_name, 'scale'] == 'Yes'){
                det_cov[,det_cov_name] <- scale(det_cov[,det_cov_name])
            }
        }
        else{ # if categorical
            det_cov[,det_cov_name] <- as.factor(det_cov[,det_cov_name])
        }
    }   

    # Create unmarked frame
    DH <- as.data.frame(DH)
    all_covs <- all_covs
    all_covs_names <- names(all_covs)
    all_covs_names <- all_covs_names[all_covs_names != station_col]
    for (all_cov_name in all_covs_names){
        if (cov_options[all_cov_name,'type'] == 'Numeric'){ # if numeric
            all_covs[,all_cov_name] <- as.numeric(all_covs[,all_cov_name])
            if (cov_options[all_cov_name, 'scale'] == 'Yes'){
                all_covs[,all_cov_name] <- scale(all_covs[,all_cov_name])
            }
        }
        else{ # if categorical
            all_covs[,all_cov_name] <- as.factor(all_covs[,all_cov_name])
        }
    }

    if (nrow(all_covs) == 0){
        data_umf <- unmarkedFrameOccu(y = DH)
        all_covs <- data.frame(site_id = unique(cameras[,station_col]))
    }
    else {
        data_umf <- unmarkedFrameOccu(y = DH, siteCovs = all_covs)
    }

    # Fit models
    # null model
    occu_null <- occu(~1 ~1, data = data_umf)
    # All det_covs formula
    if (length(det_cov_names) == 0){
        det_cov_formula <- reformulate("1")
    }
    else{
        det_cov_formula <- reformulate(det_cov_names)
    }

    # All site_covs formula
    if (length(site_cov_names) == 0){
        site_cov_formula <- reformulate("1")
    }
    else{
        site_cov_formula <- reformulate(site_cov_names)
    }

    # null site 
    null_site_formula <- reformulate("1", response = det_cov_formula)
    occu_site_null <- occu(null_site_formula, data = data_umf)

    # null det
    null_det_formula <- as.formula(paste("~1", " ", deparse(site_cov_formula)))
    occu_det_null <- occu(null_det_formula, data = data_umf)

    # site covariates
    occu_sites <- list()
    for (site_cov_name in site_cov_names){
        occu_site_formula <- reformulate(site_cov_name, response = det_cov_formula)
        occu_sites[site_cov_name] <- occu(occu_site_formula, data = data_umf)
    }

    # det covariates
    occu_dets <- list()
    for (det_cov_name in det_cov_names){
        occu_det_formula <- as.formula(paste("~", det_cov_name, " ", deparse(site_cov_formula)))
        occu_dets[det_cov_name] <- occu(occu_det_formula, data = data_umf)
    }

    # all site and detection covariates
    if (length(site_cov_names) == 0){
        global_formula <- reformulate('1', response = det_cov_formula)
    }
    else{
        global_formula <- reformulate(site_cov_names, response = det_cov_formula)
    }
    occu_global <- occu(global_formula, data = data_umf)

    # Compare models
    models <- list()
    models[deparse(occu_null@formula)] <- occu_null
    models[deparse(occu_site_null@formula)] <- occu_site_null
    models[deparse(occu_det_null@formula)] <- occu_det_null
    models[deparse(occu_global@formula)] <- occu_global
    for (site_cov_name in site_cov_names) {
        models[deparse((occu_sites[[site_cov_name]])@formula)] <- occu_sites[[site_cov_name]]
    }
    for (det_cov_name in det_cov_names) {
        models[deparse((occu_dets[[det_cov_name]])@formula)] <- occu_dets[[det_cov_name]]
    }

    # AICc
    aic1 <- aictab(models)

    # Model selection
    model_sel_name <- aic1[1,1]
    best_model <- models[[model_sel_name]]

    # Convert aic1 to dataframe and then to list to return
    aic1 <- as.data.frame(aic1)

    # Predictions
    best_model_formula <- best_model@formula
    best_model_cov_names <- all.vars(best_model_formula)
    formula_str <- deparse(best_model_formula)

    # Convert best_model summary to dataframe
    best_model_summary <- summary(best_model)
    best_model_summary_state <- as.data.frame(best_model_summary$state)
    best_model_summary_det <- as.data.frame(best_model_summary$det)
    
    # Add an index column to the dataframes
    best_model_summary_state$Name <- rownames(best_model_summary_state)
    best_model_summary_det$Name <- rownames(best_model_summary_det)

    # Move the Name column to the front
    best_model_summary_state <- best_model_summary_state[,c(ncol(best_model_summary_state),1:(ncol(best_model_summary_state)-1))]
    best_model_summary_det <- best_model_summary_det[,c(ncol(best_model_summary_det),1:(ncol(best_model_summary_det)-1))]

    nr_plots <- 2
    return_list <- list('nr_plots' = nr_plots, 'best_model_cov_names' = best_model_cov_names, 'naive_occu' = naive_occupancy, 'total_sites' = total_sites, 'total_sites_occupied' = sites_with_species, 'best_model_formula' = formula_str, 'model_sel_name' = model_sel_name, 'aic' = aic1, 'best_model_summary_state'= best_model_summary_state, 'best_model_summary_det' = best_model_summary_det)

    species <<- species
    best_model <<- best_model
    best_model_cov_names <<- best_model_cov_names
    site_cov_names <<- site_cov_names
    det_cov_names <<- det_cov_names
    all_covs <<- all_covs
    model_sel_name <<- model_sel_name
    cov_options <<- cov_options

    return(return_list)

}


plot_occupancy <- function(idx, file_name, cov_name){
    # Plot occupancy for a species using the detection and site dataframes
    if (cov_name %in% det_cov_names){
        pred_type <- "det"
        label <- "Detection probability"
    }
    else if (cov_name %in% site_cov_names){
        pred_type <- "state"
        label <- "Occupancy probability"
    }
    else{
        if (idx == 1){
            pred_type <- "state"
            label <- "Occupancy probability"
        }
        else{
            pred_type <- "det"
            label <- "Detection probability"
        }

        if(cov_name == '~1 ~ 1'){
            idx <- 1
        }	
    }

    if (idx == 1){
        if (cov_name == '~1 ~ 1'){
            newdata1 <- all_covs
            pred1 <- predict(best_model, type = pred_type, newdata = newdata1, appendData = T)
        }
        else{
            newdata1 <- all_covs 
            for (site_cov_name in site_cov_names){
                if (site_cov_name != cov_name){
                    if (cov_options[site_cov_name,'type'] == 'Numeric') {
                        newdata1[,site_cov_name] <- mean(all_covs[,site_cov_name])
                    }
                    else{
                        newdata1[,site_cov_name] <- all_covs[1,site_cov_name]
                    }
                }
            }
            for (det_cov_name in det_cov_names){
                if (det_cov_name != cov_name){
                    if (cov_options[det_cov_name,'type'] == 'Numeric') {
                        newdata1[,det_cov_name] <- mean(all_covs[,det_cov_name])
                    }
                    else{
                        newdata1[,det_cov_name] <- all_covs[1,det_cov_name]
                    }
                }
            }

            pred1 <- predict(best_model, type = pred_type, newdata = newdata1, appendData = T)
        }

        # Extract the first part of site_id before the first underscore
        pred1$site_label <- sapply(strsplit(as.character(pred1$site_id), "_"), "[", 1)

        # Plot and save image locally 
        file_name <- paste0(file_name, ".JPG")
        jpeg(file = file_name, quality = 100, width = 800, height = 800, units = "px", pointsize = 16)

        y_lab <- paste0("Predicted ", label , " for ", species, " (", cov_name, ")")
        # Plot occupancy per site for covariate
        b <- ggplot(pred1, aes(x=reorder(site_label, -Predicted), y= Predicted)) +
            geom_point(pred1$predicted) +
            geom_errorbar(aes(ymin=lower, ymax=upper), width=.2, size =1) +
            theme(axis.text.x  = element_text(angle = 90,hjust = 1, vjust = 0.5)) +
            labs(y=y_lab , x = "Sites")+
            theme(axis.text=element_text(size=12, color =  "black")) +
            coord_flip()

        print(b)
        dev.off()
    }
    else {
        # Predictions for each covariate
        file_name <- paste0(file_name, ".JPG")
        jpeg(file = file_name, quality = 100, width = 800, height = 800, units = "px", pointsize = 16)

        # Check if covariate is either numerical or categorical
        isnum <- is.numeric(all_covs[,cov_name])

        if (isnum) {
            newdata2 <- all_covs
            for (site_cov_name in site_cov_names){
                if (cov_options[site_cov_name,'type'] == 'Numeric') {
                    newdata2[,site_cov_name] <- mean(all_covs[,site_cov_name])
                }
                else {
                    newdata2[,site_cov_name] <- all_covs[1,site_cov_name]
                }
            }
            for (det_cov_name in det_cov_names){
                if (cov_options[det_cov_name,'type'] == 'Numeric') {
                    newdata2[,det_cov_name] <- mean(all_covs[,det_cov_name])
                }
                else {
                    newdata2[,det_cov_name] <- all_covs[1,det_cov_name]
                }
            }
            newdata2[,cov_name] <- seq(min(all_covs[,cov_name]), max(all_covs[,cov_name]),length = length(all_covs[,cov_name]))

            pred2 <- predict(best_model, type = pred_type, newdata = newdata2, appendData = T)

            # Plot predicted occupancy per covariate
            f2 <- ggplot(pred2, aes_string(cov_name, 'Predicted', ymin='lower',ymax='upper')) +
            geom_line(colour = "blue") + 
            geom_ribbon(alpha=0.2,colour=NA) + 
            labs(x = cov_name, y = label) +
            theme_bw() +
            theme(axis.text=element_text(size=15),axis.line=element_line(colour="black"))+
            ylim(0,1)
        }
        else {
            newdata2 <- data.frame(covariate = unique(all_covs[,cov_name]))
            for (site_cov_name in site_cov_names){
                if (cov_options[site_cov_name,'type'] == 'Numeric') {
                    newdata2[,site_cov_name] <- mean(all_covs[,site_cov_name])
                }
                else {
                    newdata2[,site_cov_name] <- all_covs[1,site_cov_name]
                }
            }

            for (det_cov_name in det_cov_names){
                if (cov_options[det_cov_name,'type'] == 'Numeric') {
                    newdata2[,det_cov_name] <- mean(all_covs[,det_cov_name])
                }
                else {
                    newdata2[,det_cov_name] <- all_covs[1,det_cov_name]
                }
            }
            newdata2[,cov_name] <- unique(all_covs[,cov_name])

            pred2 <- predict(best_model, type = pred_type, newdata = newdata2, appendData = T)

            # Plot predicted occupancy per covariate
            f2 <- ggplot(pred2, aes_string(cov_name, 'Predicted', ymin='lower',ymax='upper')) +
            geom_point(colour = "black") +
            geom_errorbar(aes(ymin=lower, ymax=upper), width=.2, size =1) +
            labs(x = cov_name, y = label) +
            theme_bw() +
            theme(axis.text=element_text(size=15),axis.line=element_line(colour="black"))+
            ylim(0,1)
        }
        

        print(f2)
        dev.off()
    }

}


get_occupancy_from_csv <- function() {
    # Update the parameters below for your use case

    # CSV file path
    detection_file <- 'R/detection.csv'  # CSV file with detection data
    site_file <- 'R/site.csv'     # CSV file with site data
    site_cov_file <- 'R/site_cov.csv'  # CSV file with site covariate data
    det_cov_file <- 'R/det_cov.csv'       # CSV file with detection covariate data
    all_cov_file <- 'R/all_cov.csv'    # CSV file with all covariate data
    cov_options_file <- 'R/cov_options.csv'       # CSV file with covariate options

    # Read csv file
    detection_data <- read.csv(detection_file, header = TRUE, sep = ",")
    site_data <- read.csv(site_file, header = TRUE, sep = ",")
    site_cov_data <- read.csv(site_cov_file, header = TRUE, sep = ",")
    det_cov_data <- read.csv(det_cov_file, header = TRUE, sep = ",")
    all_cov_data <- read.csv(all_cov_file, header = TRUE, sep = ",")
    cov_options_data <- read.csv(cov_options_file, header = TRUE, sep = ",")

    # Convert to R dataframe
    detection_data <- as.data.frame(detection_data)
    site_data <- as.data.frame(site_data)
    site_cov_data <- as.data.frame(site_cov_data)
    det_cov_data <- as.data.frame(det_cov_data)
    all_cov_data <- as.data.frame(all_cov_data)
    cov_options_data <- as.data.frame(cov_options_data)

    # Convert cov_options_data's first column to rownames (index)
    rownames(cov_options_data) <- cov_options_data[,1]

    # Other parameters
    species <- 'Leopard' # Species name
    window <- 10  # Window size in days
    setup_col <- 'first_date' # Column name for setup date in site_data
    retrieval_col <- 'last_date' # Column name for retrieval date in site_data
    station_col <- 'site_id' # Column name for station id in site_data

    # Run occupancy
    occupancy_results <- occupancy(detection_data, site_data, setup_col, retrieval_col, station_col, window, site_cov_data, det_cov_data, all_cov_data, species, cov_options_data)

    # Print results
    print(occupancy_results)

    best_model_cov_names <- occupancy_results$best_model_cov_names
    nr_plots <- occupancy_results$nr_plots

    # Plot results
    if (length(best_model_cov_names) > 0) {
        for (best_model_cov_name in best_model_cov_names) {
            for (i in 1:nr_plots) {
                file_name = paste(species, best_model_cov_name, sep = "_")
                file_name = paste(file_name, i, sep = "_")
                plot_occupancy(i, file_name, best_model_cov_name)
            }
        }
    }
    else {
        model_name = "~1 ~ 1"
        for (i in 1:nr_plots) {
            file_name = paste(species, model_name, sep = "_")
            file_name = paste(file_name, i, sep = "_")
            plot_occupancy(i, file_name, model_name)
        }
    }
    
}