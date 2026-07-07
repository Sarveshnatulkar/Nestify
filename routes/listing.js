"use strict";

const express   = require("express");
const multer    = require("multer");
const router    = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { storage }          = require("../cloudConfig.js");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");
const { validateFiles }    = require("../utils/validate.js");
const listingController    = require("../controllers/listing.js");

const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB per file
});

router.route("/")
    .get(wrapAsync(listingController.index))
    .post(
        isLoggedIn,
        upload.single("listing[image]"),
        validateFiles,
        validateListing,
        wrapAsync(listingController.createListing)
    );

router.get("/new", isLoggedIn, listingController.renderNewForm);

router.route("/:id")
    .get(wrapAsync(listingController.showListing))
    .put(
        isLoggedIn,
        isOwner,
        upload.single("listing[image]"),
        validateFiles,
        validateListing,
        wrapAsync(listingController.updateListing)
    )
    .delete(isLoggedIn, isOwner, wrapAsync(listingController.destroyListing));

router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listingController.renderEditForm));

module.exports = router;
