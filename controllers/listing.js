"use strict";

const Listing        = require("../models/listing.js");
const { geocode }    = require("../utils/geocode.js");
const { cloudinary } = require("../cloudConfig.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Delete an array of Cloudinary public_ids in parallel. */
const deleteFromCloudinary = async (filenames) => {
    if (!filenames || filenames.length === 0) return;
    await Promise.all(filenames.map((id) => cloudinary.uploader.destroy(id)));
};

/** Map multer file objects → { filename, url } shape used by the model. */
const mapFiles = (files) =>
    (files || []).map((f) => ({ filename: f.filename, url: f.path }));

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

    // ── Build query ───────────────────────────────────────────────────────────
    // Project only fields the index page actually renders — skip description,
    // geometry, owner (not used on cards) to reduce payload.
    const projection = {
        title: 1, price: 1, location: 1, country: 1,
        category: 1, images: 1, reviews: 1, createdAt: 1,
        ...(searchTerm ? { score: { $meta: "textScore" } } : {}),
    };

    let listingQuery = Listing.find(filter, projection);
    if (searchTerm && !sort) sortOption = { score: { $meta: "textScore" } };

    // Populate only the rating field — we don't need comment/author/timestamps
    // for the rating-filter calculation on the index page.
    listingQuery = listingQuery
        .sort(sortOption)
        .populate({ path: "reviews", select: "rating" })
        .lean();                        // plain JS objects — faster than Mongoose docs

    // Run listings query and distinct countries in parallel
    const [allListingsRaw, allCountries] = await Promise.all([
        listingQuery,
        Listing.distinct("country"),
    ]);

    allCountries.sort();

    // ── Post-query rating filter ──────────────────────────────────────────────
    let allListings = allListingsRaw;
    if (minRating) {
        const min = Number(minRating);
        allListings = allListingsRaw.filter((l) => {
            if (!l.reviews || !l.reviews.length) return false;
            const avg = l.reviews.reduce((s, r) => s + (r.rating || 0), 0) / l.reviews.length;
            return avg >= min;
        });
    }

    // ── Inject thumbnail URLs via Cloudinary transforms ───────────────────────
    // Cards display at ~400px wide — no need to serve 1920px originals.
    allListings = allListings.map((l) => {
        const img = (l.images && l.images.length > 0) ? l.images[0] : null;
        return {
            ...l,
            _thumbUrl: img
                ? cloudinaryResize(img.url, 600, 450)
                : "https://images.unsplash.com/photo-1720884413532-59289875c3e1?q=80&w=600&auto=format",
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
        // Only fetch username from User — not email, hash, salt, timestamps
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
    newListing.images   = mapFiles(req.files);
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
    const thumbnails = listing.images.map((img) => ({
        filename: img.filename,
        url:      img.url,
        thumb:    cloudinaryResize(img.url, 200, 150),
    }));
    res.render("listings/edit.ejs", { listing, thumbnails });
};

// PUT /listings/:id
module.exports.updateListing = async (req, res) => {
    const { id } = req.params;
    const { image, ...listingData } = req.body.listing || {};
    const listing = await Listing.findByIdAndUpdate(id, listingData, { new: true });

    const toDelete = Array.isArray(req.body.deleteImages)
        ? req.body.deleteImages
        : req.body.deleteImages ? [req.body.deleteImages] : [];

    if (toDelete.length) {
        await deleteFromCloudinary(toDelete);
        listing.images = listing.images.filter((img) => !toDelete.includes(img.filename));
    }

    if (req.files && req.files.length > 0) {
        if (listing.images.length + req.files.length > 5) {
            req.flash("error", "A listing can have at most 5 images.");
            return res.redirect(`/listings/${id}/edit`);
        }
        listing.images.push(...mapFiles(req.files));
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
        await deleteFromCloudinary(listing.images.map((i) => i.filename));
    }
    req.flash("success", "Listing deleted!");
    res.redirect("/listings");
};
