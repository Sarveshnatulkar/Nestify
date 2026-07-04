"use strict";

const Listing  = require("../models/listing.js");
const { geocode } = require("../utils/geocode.js");

// GET /listings
module.exports.index = async (req, res) => {
    const q = (req.query.q || "").trim();

    let allListings;

    if (q) {
        allListings = await Listing
            .find(
                { $text: { $search: q } },
                { score: { $meta: "textScore" } }
            )
            .sort({ score: { $meta: "textScore" } });
    } else {
        allListings = await Listing.find({});
    }

    res.render("listings/index.ejs", {
        allListings,
        q,
        resultCount: allListings.length,
    });
};

// GET /listings/new
module.exports.renderNewForm = (req, res) => {
    res.render("listings/new.ejs");
};

// GET /listings/:id
module.exports.showListing = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing
        .findById(id)
        .populate({ path: "reviews", populate: { path: "author" } })
        .populate("owner");

    if (!listing) {
        req.flash("error", "Listing you are looking for does not exist!");
        return res.redirect("/listings");
    }

    res.render("listings/show.ejs", { listing });
};

// POST /listings
module.exports.createListing = async (req, res) => {
    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;

    if (req.file) {
        newListing.image = { filename: req.file.filename, url: req.file.path };
    }

    // Geocode the address and store coordinates
    newListing.geometry = await geocode(newListing.location, newListing.country);

    await newListing.save();
    req.flash("success", "New listing created!");
    res.redirect("/listings");
};

// GET /listings/:id/edit
module.exports.renderEditForm = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing you are looking for does not exist!");
        return res.redirect("/listings");
    }
    const originalImageUrl = listing.image.url.replace("/upload", "/upload/w_250");
    res.render("listings/edit.ejs", { listing, originalImageUrl });
};

// PUT /listings/:id
module.exports.updateListing = async (req, res) => {
    const { id } = req.params;
    const { image, ...listingData } = req.body.listing || {};
    const listing = await Listing.findByIdAndUpdate(id, listingData, { new: true });

    if (req.file) {
        listing.image = { url: req.file.path, filename: req.file.filename };
    }

    // Re-geocode whenever location or country may have changed
    listing.geometry = await geocode(listing.location, listing.country);

    await listing.save();
    req.flash("success", "Listing updated!");
    res.redirect(`/listings/${id}`);
};

// DELETE /listings/:id
module.exports.destroyListing = async (req, res) => {
    const { id } = req.params;
    await Listing.findByIdAndDelete(id);
    req.flash("success", "Listing deleted!");
    res.redirect("/listings");
};
