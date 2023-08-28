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

library(oSCR)
library(raster)
library(sf)
library(car)
library(carData)
library(Formula)
library(Rcapture)

trim <-0

spatial_capture_recapture <- function(edf, tdf, session_col, id_col, occ_col, trap_col, tag_col, sep, cov_names, cov_options, dh, file_names){

    message = ''
    # 0. Rcapture
    # 0.1 Create capture history
    rownames(dh) <- dh$individual_id
    dh$individual_id <- NULL
    dhm <- as.matrix(dh)
    MRC0 <- closedp.0(dhm)

    cr <- as.data.frame(MRC0$results)
    # Add index column
    cr$Model <- rownames(cr)

    # remove rows where infofit is not 0
    cr <- cr[cr$infoFit == 0,]

    # remove infofit column
    cr$infoFit <- NULL

    # rename columns
    colnames(cr)[colnames(cr) == 'abundance'] <- 'Abundance'
    colnames(cr)[colnames(cr) == 'stderr'] <- 'Standard Error'
    colnames(cr)[colnames(cr) == 'deviance'] <- 'Deviance'
    colnames(cr)[colnames(cr) == 'df'] <- 'Degrees of Freedom'

    # reorder columns
    cr <- cr[,c(7,1,2,3,4,5,6)]

    # 1. Create oSCR data object
    cov_col_names <- c()
    if (length(cov_names) > 0){
        for (cov_name in cov_names){
            cov_col_names <- c(cov_col_names, cov_name)
        }
    }
    else{
        cov_col_names <- c()
    }

    for (cov_name in cov_col_names){
        if (cov_options[cov_name,'type'] == 'Numeric'){ # if numeric
            tdf[,cov_name] <- as.numeric(tdf[,cov_name])
            if (cov_options[cov_name, 'scale'] == 'Yes'){
                tdf[,cov_name] <- scale(tdf[,cov_name])
            }
        }
        else{ # if categorical
            tdf[,cov_name] <- as.factor(tdf[,cov_name])
        }
    }


    if (tag_col != "none"){
        if (length(cov_col_names) > 0){
            species.data <- 
                data2oscr(edf = edf, 
                            tdf = list(tdf), 
                            sess.col = which(colnames(edf) %in% session_col), 
                            id.col = which(colnames(edf) %in% id_col),
                            occ.col = which(colnames(edf) %in% occ_col), 
                            trap.col = which(colnames(edf) %in% trap_col),
                            sex.col = which(colnames(edf) %in% tag_col),
                            sex.nacode = "NA",
                            K = sum(grepl(occ_col, colnames(tdf))), 
                            ntraps = nrow(tdf),
                            trapcov.names = cov_col_names,
                            tdf.sep = sep)
        }
        else {
            species.data <- 
                data2oscr(edf = edf, 
                            tdf = list(tdf), 
                            sess.col = which(colnames(edf) %in% session_col), 
                            id.col = which(colnames(edf) %in% id_col),
                            occ.col = which(colnames(edf) %in% occ_col), 
                            trap.col = which(colnames(edf) %in% trap_col),
                            sex.col = which(colnames(edf) %in% tag_col),
                            sex.nacode = "NA",
                            K = sum(grepl(occ_col, colnames(tdf))), 
                            ntraps = nrow(tdf))
        }
    }
    else{
        if (length(cov_col_names) > 0){
            species.data <- 
                data2oscr(edf = edf, 
                            tdf = list(tdf), 
                            sess.col = which(colnames(edf) %in% session_col), 
                            id.col = which(colnames(edf) %in% id_col),
                            occ.col = which(colnames(edf) %in% occ_col), 
                            trap.col = which(colnames(edf) %in% trap_col),
                            K = sum(grepl(occ_col, colnames(tdf))), 
                            ntraps = nrow(tdf),
                            trapcov.names = cov_col_names,
                            tdf.sep = sep)
        }
        else {
            species.data <- 
                data2oscr(edf = edf, 
                            tdf = list(tdf), 
                            sess.col = which(colnames(edf) %in% session_col), 
                            id.col = which(colnames(edf) %in% id_col),
                            occ.col = which(colnames(edf) %in% occ_col), 
                            trap.col = which(colnames(edf) %in% trap_col),
                            K = sum(grepl(occ_col, colnames(tdf))), 
                            ntraps = nrow(tdf))
        }
    }


    # 2. Extract data from oSCR object
    species.sf <- species.data$scrFrame

    # get summary statistics
    nr_occasions <- species.sf$occasions
    mmdm <- species.sf$mmdm
    nr_sites <- nrow(tdf)
    nr_individuals <- length(unique(edf$individual_id))
    
    # Create summary df 
    summary_df <- data.frame(Individuals = nr_individuals, Sites = nr_sites, Occasions = nr_occasions, MMDM = mmdm, HMMDM = mmdm/2)

    if(mmdm == 0){
        print('MMDMD is 0')
        mmdm <- 2
        species.sf$mmdm <- mmdm
    }
    hmmdm <- mmdm / 2
    

    # 3. Create state-space object
    buffer <- 3 * hmmdm
    resolution <- hmmdm / 2
    resolution <- round(resolution, 1)
    buffer <- round(buffer, 1)
    species.ss <- make.ssDF(species.sf, res=resolution, buff=buffer)

    # 4. Create oSCR model object
    t <- mmdm * 3
    # Always round up
    t <- ceiling(t)
    trim <<- t

    # null model
    m0 <- NULL
    tryCatch({
        m0 <- oSCR.fit(list(D~1,p0~1,sig~1), species.sf, species.ss, trimS=trim)
    }, error = function(e){
        print(e)
        message <- 'Model failed to fit. '
        m0 <- NULL
        print(message)
    })

    # Other models will follow
    sex_models <- list()
    if (tag_col != 'none'){
        tryCatch({
            ms1 <- oSCR.fit(list(D~1,p0~1,sig~sex), species.sf, species.ss, trimS=trim)
            # add to list
            sex_models[['ms1']] <- ms1
        }, error = function(e){
            print(e)
            message <- 'Model failed to fit. '
            ms1 <- NULL
        })

        tryCatch({
            ms2 <- oSCR.fit(list(D~1,p0~sex,sig~1), species.sf, species.ss, trimS=trim)
            sex_models[['ms2']] <- ms2
        }, error = function(e){
            print(e)
            message <- 'Model failed to fit. '
            ms2 <- NULL
        })

        tryCatch({
            ms3 <- oSCR.fit(list(D~1,p0~sex,sig~sex), species.sf, species.ss, trimS=trim)
            sex_models[['ms3']] <- ms3
        }, error = function(e){
            print(e)
            message <- 'Model failed to fit. '
            ms3 <- NULL
        })


        # ms1 <- oSCR.fit(list(D~1,p0~1,sig~sex), species.sf, species.ss, trimS=trim)
        # ms2 <- oSCR.fit(list(D~1,p0~sex,sig~1), species.sf, species.ss, trimS=trim)
        # ms3 <- oSCR.fit(list(D~1,p0~sex,sig~sex), species.sf, species.ss, trimS=trim)
        # sex_models <- list(ms1=ms1, ms2=ms2, ms3=ms3)
    }

    cov_models <- list()
    if (length(cov_col_names) > 0){
        for (cov_name in cov_col_names){
            # p0
            tryCatch({
                cov_model_p <- paste(' ', cov_name, sep = "")
                cov_model_p <- paste("p0~", cov_model_p, sep = "")
                cov_model_p <- as.formula(cov_model_p)
                cov_model <- oSCR.fit(list(D~1,cov_model_p,sig~1), species.sf, species.ss, trimS=trim)
                cov_models[[cov_name]] <- cov_model
            }, error = function(e){
                print(e)
                message <- 'Model failed to fit. '
                cov_model <- NULL
            })
            # cov_model_p <- paste(' ', cov_name, sep = "")
            # cov_model_p <- paste("p0~", cov_model_p, sep = "")
            # cov_model_p <- as.formula(cov_model_p)
            # print(cov_model_p)
            # cov_model <- oSCR.fit(list(D~1,cov_model_p,sig~1), species.sf, species.ss, trimS=trim)
            # # cov_models <- c(cov_models, cov_model)
            # print(cov_model)
            # cov_models[[cov_name]] <- cov_model
        }
    }

    # cov_sex_models <- list()
    # if (tag_col != 'none' && lenght(cov_col_names) > 0){
    #     for (cov_name in cov_col_names){
    #         # p0 - sex + cov sig - 1
    #         cov_model_p <- paste(' ', cov_name, sep = "")
    #         cov_model_p <- paste("p0~sex+", cov_model_p, sep = "")
    #         cov_model_p <- as.formula(cov_model_p)
    #         print(cov_model_p)
    #         cov_model <- oSCR.fit(list(D~1,cov_model_p,sig~1), species.sf, species.ss, trimS=trim)
    #         # cov_models <- c(cov_models, cov_model)
    #         print(cov_model)
    #         cov_sex_models[[cov_model_p]] <- cov_model

    #         #p0 - cov sig- sex
    #         cov_model_p <- paste(' ', cov_name, sep = "")
    #         cov_model_p <- paste("p0~", cov_model_p, sep = "")
    #         cov_model_p <- as.formula(cov_model_p)
    #         print(cov_model_p)
    #         cov_model <- oSCR.fit(list(D~1,cov_model_p,sig~sex), species.sf, species.ss, trimS=trim)
    #         # cov_models <- c(cov_models, cov_model)
    #         print(cov_model)
    #         cov_sex_models[[cov_model_p]] <- cov_model

    #         #p0 - sex + cov + sig - sex
    #         cov_model_p <- paste(' ', cov_name, sep = "")
    #         cov_model_p <- paste("p0~sex+", cov_model_p, sep = "")
    #         cov_model_p <- as.formula(cov_model_p)
    #         print(cov_model_p)
    #         cov_model <- oSCR.fit(list(D~1,cov_model_p,sig~sex), species.sf, species.ss, trimS=trim)
    #         # cov_models <- c(cov_models, cov_model)
    #         cov_sex_models[[cov_model_p]] <- cov_model



    #     }
    # }

    # 5. Model selection (will do later)
    if (is.null(m0)){
        model_list <- list()
    }
    else{
        model_list <- list(m0=m0)
    }
    if (!is.null(sex_models)) {
        model_list <- c(model_list, sex_models)
    }
    if (!is.null(cov_models)) {
        model_list <- c(model_list, cov_models)
    }

    # Fit models
    if (length(model_list) == 0){
        message <- paste(message, 'No models were fitted. Please ensure that the data is correct and try again.')

        # make empty dataframes
        density <- data.frame()
        abundance <- data.frame()
        det_prob <- data.frame()
        sigma <- data.frame()
        aic_df <- data.frame()
        summary_df$best_model <- 'None'
        summary_df$best_model_formula <- 'None'

    }
    else{
        fl <- fitList.oSCR(model_list)
        # Model selection
        ms <- modSel.oSCR(fl)

        #AIC 
        aic <- ms$aic.tab
        aic_df <- as.data.frame(aic)

        # Add a column for model formulas to aic_df
        model_formulas <- c()
        for (i in 1:nrow(aic_df)){
            model_name <- aic_df[i,1]
            model <- model_list[[model_name]]$model
            model_formula <- paste(model[[1]], model[[2]], model[[3]], sep = " ")
            model_formulas <- c(model_formulas, model_formula)
        }
        aic_df$model_formula <- model_formulas

        # Rename columns in aic_df
        colnames(aic_df)[colnames(aic_df) == 'model'] <- 'Model'
        colnames(aic_df)[colnames(aic_df) == 'weight'] <- 'Weight'
        colnames(aic_df)[colnames(aic_df) == 'model_formula'] <- 'Model Formula'

        # Reorder columns in aic_df so that Model Formula is the second column
        aic_df <- aic_df[,c(1,8,2,3,4,5,6,7)]

        # Select best model
        model_name <- aic[1,1]
        best_model <- model_list[[model_name]]
        bm_model <- best_model$model
        best_model_formula <- paste(bm_model[[1]], bm_model[[2]], bm_model[[3]], sep = " ")
        summary_df$best_model <- model_name
        summary_df$best_model_formula <- best_model_formula
        # best_model <- ms$best.model

        # 6. Model predictions
        # 6.1 Density (res 100km2)
        factor <- 100/(resolution^2)
        pred.df.dens <- data.frame(Session = factor(1))
        pred.dens <- get.real(model = best_model, newdata = pred.df.dens, type = "dens", d.factor = factor)
        density <- as.data.frame(pred.dens)

        pred.abd <- get.real(model = best_model, newdata = pred.df.dens, type = "dens", d.factor = nrow(best_model$ssDF[[1]]))
        abundance <- as.data.frame(pred.abd)
        state_space <- nrow(best_model$ssDF[[1]])
        abundance$state_space <- state_space * (resolution^2)


        # 6.2 Encounter probability
        if (model_name == 'm0'){
            pred.df.det <- data.frame(Session = factor(1))
        }
        else if (tag_col != 'none' && model_name %in% c('ms1', 'ms2', 'ms3')){
            pred.df.det <- data.frame(Session = factor(1), sex=factor(c(0,1)))
        }
        else{
            model_data <- unique(tdf[,model_name])
            pred.df.det <- data.frame(Session = factor(1), model_name = model_data)
            colnames(pred.df.det)[colnames(pred.df.det) == 'model_name'] <- model_name
        }
        pred.det <- get.real(model = best_model, newdata = pred.df.det, type = "det")
        det_prob <- as.data.frame(pred.det)

        # 6.3 Sigma 
        if (model_name == 'm0'){
            pred.df.sigma <- data.frame(Session = factor(1))
        }
        else if (tag_col != 'none' && model_name %in% c('ms1', 'ms2', 'ms3')){
            pred.df.sigma <- data.frame(Session = factor(1), sex=factor(c(0,1)))
        }
        else{
            pred.df.sigma <- data.frame(Session = factor(1))
        }
        pred.sigma <- get.real(model = best_model, newdata = pred.df.sigma, type = "sig")
        sigma <- as.data.frame(pred.sigma)

        # 7. Plotting
        labs <- tdf$site_id <- sapply(strsplit(as.character(tdf$site_id), "_"), "[", 1)
        # 7.1 Spatial Captures
        file_name <- paste0(file_names[1], ".JPG")
        jpeg(file = file_name, quality = 100, width = 800, height = 800, units = "px", pointsize = 16)
        plot(species.sf)
        title(xlab="X (UTM)", ylab="Y (UTM)")
        text(species.sf$traps[[1]], labels=labs, pos=3)
        dev.off()

        # 7.2 State-space (spider)
        file_name <- paste0(file_names[2], ".JPG")
        jpeg(file = file_name, quality = 100, width = 800, height = 800, units = "px", pointsize = 16)
        plot(species.ss, species.sf, spider=TRUE)
        text(species.sf$traps[[1]], labels=labs, pos=3)
        dev.off()

        # 7.3 Density Map
        file_name <- paste0(file_names[3], ".JPG")
        jpeg(file = file_name, quality = 100, width = 800, height = 800, units = "px", pointsize = 16)
        pred <- predict.oSCR(scrFrame=species.sf, best_model, ssDF=species.ss)
        plot(pred$r[[1]], xlab="X (UTM)", ylab="Y (UTM)", zlab="Density")
        points(tdf[,2:3], pch=20, lwd=0.5)
        text(tdf[,2:3], labels=labs, pos=3)
        dev.off()

    }


    return (list(density = density, abundance = abundance, det_prob = det_prob, sigma = sigma, summary = summary_df, aic = aic_df, cr = cr, message = message))

}


get_scr <-function(){
    # Update parameters for own use case 

    # Get edf and tdf csv files
    edf <- read.csv("edf.csv", header = TRUE)
    tdf <- read.csv("tdf.csv", header = TRUE)

    # Get column names
    session_col <- "session"
    id_col <- "individual_id"
    occ_col <- "occasion"
    trap_col <- "site_id"
    # If sex is not available, set to "none"
    tag_col <- 'indiv_tags'

    # If covariates are not available, set to empty list
    cov_names <- c('Flash')
    sep <- '/'
    # Type can be 'Numeric' or 'Categorical' and scale can be 'Yes' or 'No'. The row name should be the name of the covariate.
    cov_options <- data.frame(type = c('Categorical'), scale = c('No'))
    rownames(cov_options) <- 'Flash'
    # Get file names for plots
    file_names <- c("Captures", "State_space", "Density_map")

    # Run function
    result <- spatial_capture_recapture(edf, tdf, session_col, id_col, occ_col, trap_col, tag_col, sep, cov_names, cov_options, file_names)
}