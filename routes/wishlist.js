"use strict";

const express            = require("express");
const router             = express.Router();
const wrapAsync          = require("../utils/wrapAsync.js");
const { isLoggedIn }     = require("../middleware.js");
const wishlistController = require("../controllers/wishlist.js");

// Wishlist page
router.get("/", isLoggedIn, wrapAsync(wishlistController.showWishlist));

// Add a listing
router.post("/:listingId", isLoggedIn, wrapAsync(wishlistController.addToWishlist));

// Remove a listing
router.delete("/:listingId", isLoggedIn, wrapAsync(wishlistController.removeFromWishlist));

module.exports = router;
