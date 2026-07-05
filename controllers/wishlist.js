"use strict";

const User    = require("../models/user.js");
const Listing = require("../models/listing.js");

// Safe redirect helper — only follows relative paths from Referer
const safeReferer = (req, fallback) => {
    const ref = req.get("Referer") || "";
    try {
        const url = new URL(ref);
        // Only redirect to same origin
        if (url.origin === `${req.protocol}://${req.get("host")}`) {
            return url.pathname + url.search;
        }
    } catch {
        // Not a valid URL
    }
    return fallback;
};

// GET /wishlist
module.exports.showWishlist = async (req, res) => {
    const user = await User
        .findById(req.user._id)
        .populate({
            path:    "wishlist",
            options: { sort: { createdAt: -1 } },
        });

    res.render("wishlist/index.ejs", { wishlist: user.wishlist });
};

// POST /wishlist/:listingId  — add to wishlist
module.exports.addToWishlist = async (req, res) => {
    const { listingId } = req.params;

    const listing = await Listing.findById(listingId);
    if (!listing) {
        req.flash("error", "Listing not found.");
        return res.redirect("/listings");
    }

    await User.findByIdAndUpdate(req.user._id, {
        $addToSet: { wishlist: listingId },
    });

    req.flash("success", `"${listing.title}" saved to your wishlist.`);
    res.redirect(safeReferer(req, `/listings/${listingId}`));
};

// DELETE /wishlist/:listingId  — remove from wishlist
module.exports.removeFromWishlist = async (req, res) => {
    const { listingId } = req.params;

    await User.findByIdAndUpdate(req.user._id, {
        $pull: { wishlist: listingId },
    });

    req.flash("success", "Removed from your wishlist.");
    res.redirect(safeReferer(req, "/wishlist"));
};
