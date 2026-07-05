"use strict";

const Listing  = require("../models/listing.js");
const { geocode } = require("../utils/geocode.js");

// GET /listings
module.exports.index = async (req, res) => {
    const {
        q        = "",
        category = "",
        country  = "",
        minPrice = "",
        maxPrice = "",
        minRating = "",
        sort     = "",
    } = req.query;

    const searchTerm = q.trim();

    // ── Build MongoDB filter ───────────────────────────────────────────────
    const filter = {};

    // Full-text search
    if (searchTerm) {
        filter.$text = { $search: searchTerm };
    }

    // Category
    if (category) filter.category = category;

    // Country (case-insensitive exact match)
    if (country) filter.country = { $regex: `^${country.trim()}$`, $options: "i" };

    // Price range
    if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = Number(minPrice);
        if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // ── Build sort ────────────────────────────────────────────────────────
    let sortOption = { createdAt: -1 }; // default: newest first
    if (sort === "price_asc")  sortOption = { price:  1 };
    if (sort === "price_desc") sortOption = { price: -1 };
    if (sort === "newest")     sortOption = { createdAt: -1 };

    // ── Query ─────────────────────────────────────────────────────────────
    let query = Listing.find(filter);

    // When using $text, also project relevance score
    if (searchTerm) {
        query = Listing.find(filter, { score: { $meta: "textScore" } });
        if (sort === "") sortOption = { score: { $meta: "textScore" } };
    }

    let allListings = await query.sort(sortOption).populate("reviews");

    // ── Rating filter (post-query — reviews are refs, not embedded values)
    if (minRating) {
        const min = Number(minRating);
        allListings = allListings.filter((listing) => {
            if (!listing.reviews.length) return false;
            const avg = listing.reviews.reduce((sum, r) => sum + (r.rating || 0), 0)
                        / listing.reviews.length;
            return avg >= min;
        });
    }

    // ── Distinct countries for the dropdown ───────────────────────────────
    const allCountries = await Listing.distinct("country");
    allCountries.sort();

    res.render("listings/index.ejs", {
        allListings,
        q:           searchTerm,
        resultCount: allListings.length,
        // Pass active filters back so the UI can reflect current state
        filters: { category, country, minPrice, maxPrice, minRating, sort },
        allCountries,
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
