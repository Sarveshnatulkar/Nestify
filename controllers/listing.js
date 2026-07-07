"use strict";

const Listing        = require("../models/listing.js");
const { geocode }    = require("../utils/geocode.js");
const { cloudinary } = require("../cloudConfig.js");

const DEFAULT_IMAGE_URL =
    "https://images.unsplash.com/photo-1720884413532-59289875c3e1" +
    "?q=80&w=735&auto=format&fit=crop&ixlib=rb-4.1.0";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Delete a single Cloudinary image by its public_id (filename). */
const deleteFromCloudinary = async (filename) => {
    if (!filename || filename === "listingimage") return;
    try {
        await cloudinary.uploader.destroy(filename);
    } catch (err) {
        console.error("Cloudinary delete failed:", err.message);
    }
};

/**
 * Build a Cloudinary URL that serves a resized version of the image.
 * Falls back to the original URL for non-Cloudinary images (e.g. Unsplash seeds).
 */
const cloudinaryResize = (url, width, height, crop = "fill") => {
    if (!url || !url.includes("/upload/")) return url;
    return url.replace("/upload/", `/upload/w_${width},h_${height},c_${crop},q_auto,f_auto/`);
};

// ── Controllers ───────────────────────────────────────────────────────────────

// GET /listings
module.exports.index = async (req, res) => {
    const {
        q         = "",
        category  = "",
        country   = "",
        minPrice  = "",
        maxPrice  = "",
        minRating = "",
        sort      = "",
    } = req.query;

    const searchTerm = q.trim();
    const filter = {};

    if (searchTerm) filter.$text    = { $search: searchTerm };
    if (category)   filter.category = category;
    if (country)    filter.country  = { $regex: `^${country.trim()}$`, $options: "i" };

    if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = Number(minPrice);
        if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    let sortOption = { createdAt: -1 };
    if (sort === "price_asc")  sortOption = { price:  1 };
    if (sort === "price_desc") sortOption = { price: -1 };
    if (sort === "newest")     sortOption = { createdAt: -1 };

    const projection = {
        title: 1, price: 1, location: 1, country: 1,
        category: 1, image: 1, reviews: 1, createdAt: 1,
        ...(searchTerm ? { score: { $meta: "textScore" } } : {}),
    };

    let listingQuery = Listing.find(filter, projection);
    if (searchTerm && !sort) sortOption = { score: { $meta: "textScore" } };

    listingQuery = listingQuery
        .sort(sortOption)
        .populate({ path: "reviews", select: "rating" })
        .lean();

    const [allListingsRaw, allCountries] = await Promise.all([
        listingQuery,
        Listing.distinct("country"),
    ]);

    allCountries.sort();

    // Post-query rating filter
    let allListings = allListingsRaw;
    if (minRating) {
        const min = Number(minRating);
        allListings = allListingsRaw.filter((l) => {
            if (!l.reviews || !l.reviews.length) return false;
            const avg = l.reviews.reduce((s, r) => s + (r.rating || 0), 0) / l.reviews.length;
            return avg >= min;
        });
    }

    // Inject thumbnail URLs — resize for card display (~600px wide)
    allListings = allListings.map((l) => {
        const rawUrl = (l.image && l.image.url) ? l.image.url : DEFAULT_IMAGE_URL;
        return {
            ...l,
            _thumbUrl: cloudinaryResize(rawUrl, 600, 450),
        };
    });

    res.render("listings/index.ejs", {
        allListings,
        q:           searchTerm,
        resultCount: allListings.length,
        filters:     { category, country, minPrice, maxPrice, minRating, sort },
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
        .populate({ path: "reviews", populate: { path: "author", select: "username" } })
        .populate("owner", "username");

    if (!listing) {
        req.flash("error", "Listing you are looking for does not exist!");
        return res.redirect("/listings");
    }
    res.render("listings/show.ejs", { listing });
};

// POST /listings
module.exports.createListing = async (req, res) => {
    const newListing    = new Listing(req.body.listing);
    newListing.owner    = req.user._id;
    if (req.file) {
        newListing.image = { filename: req.file.filename, url: req.file.path };
    }
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
    // Generate a smaller preview URL for the edit form thumbnail
    const previewImageUrl = cloudinaryResize(listing.image.url, 250, 180);
    res.render("listings/edit.ejs", { listing, previewImageUrl });
};

// PUT /listings/:id
module.exports.updateListing = async (req, res) => {
    const { id } = req.params;
    const { image, ...listingData } = req.body.listing || {};
    const listing = await Listing.findByIdAndUpdate(id, listingData, { new: true });

    if (req.file) {
        // Delete the old image from Cloudinary before replacing it
        await deleteFromCloudinary(listing.image.filename);
        listing.image = { url: req.file.path, filename: req.file.filename };
        await listing.save();
    }

    listing.geometry = await geocode(listing.location, listing.country);
    await listing.save();
    req.flash("success", "Listing updated!");
    res.redirect(`/listings/${id}`);
};

// DELETE /listings/:id
module.exports.destroyListing = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findByIdAndDelete(id);
    if (listing) {
        await deleteFromCloudinary(listing.image.filename);
    }
    req.flash("success", "Listing deleted!");
    res.redirect("/listings");
};
