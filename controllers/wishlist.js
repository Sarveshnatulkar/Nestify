"use strict";

const User    = require("../models/user.js");
const Listing = require("../models/listing.js");

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

    // $addToSet is atomic and idempotent — no duplicate check needed
    await User.findByIdAndUpdate(req.user._id, {
        $addToSet: { wishlist: listingId },
    });

    req.flash("success", `"${listing.title}" saved to your wishlist.`);
    // Redirect back to wherever the user came from
    res.redirect(req.get("Referrer") || `/listings/${listingId}`);
};

// DELETE /wishlist/:listingId  — remove from wishlist
module.exports.removeFromWishlist = async (req, res) => {
    const { listingId } = req.params;

    await User.findByIdAndUpdate(req.user._id, {
        $pull: { wishlist: listingId },
    });

    req.flash("success", "Removed from your wishlist.");
    res.redirect(req.get("Referrer") || "/wishlist");
};
