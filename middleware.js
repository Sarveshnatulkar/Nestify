"use strict";

const Listing     = require("./models/listing.js");
const Review      = require("./models/review.js");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema, reviewSchema } = require("./utils/validate.js");

// ── Authentication guard ──────────────────────────────────────────────────────
module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "You must be logged in to do that!");
        return res.redirect("/login");
    }
    next();
};

// ── Save pre-login URL so we can redirect back after login ───────────────────
module.exports.saveRedirectUrl = (req, res, next) => {
    if (req.session.redirectUrl) {
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    next();
};

// ── Listing ownership guard ───────────────────────────────────────────────────
module.exports.isOwner = async (req, res, next) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing not found!");
        return res.redirect("/listings");
    }
    if (!listing.owner._id.equals(res.locals.currUser._id)) {
        req.flash("error", "You are not the owner of this listing.");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

// ── Review authorship guard ───────────────────────────────────────────────────
module.exports.isReviewAuthor = async (req, res, next) => {
    const { id, reviewId } = req.params;
    const review = await Review.findById(reviewId);
    if (!review) {
        req.flash("error", "Review not found!");
        return res.redirect(`/listings/${id}`);
    }
    if (!review.author._id.equals(res.locals.currUser._id)) {
        req.flash("error", "You are not the author of this review.");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

// ── Validation factory ────────────────────────────────────────────────────────
// Returns an Express middleware that validates req.body against the given schema.
// allowUnknown: true — silently ignores top-level fields outside the schema
// (e.g. deleteImages, _method, CSRF tokens) so they don't cause false rejections.
const validateBody = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body, { allowUnknown: true });
    if (error) {
        const message = error.details.map((d) => d.message).join(", ");
        throw new ExpressError(400, message);
    }
    next();
};

module.exports.validateListing = validateBody(listingSchema);
module.exports.validateReview  = validateBody(reviewSchema);
