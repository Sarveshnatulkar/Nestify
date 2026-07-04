"use strict";

const mongoose = require("mongoose");
const Review   = require("./review.js");

const { Schema } = mongoose;

const DEFAULT_IMAGE_URL =
    "https://images.unsplash.com/photo-1720884413532-59289875c3e1" +
    "?q=80&w=735&auto=format&fit=crop&ixlib=rb-4.1.0";

const listingSchema = new Schema(
    {
        title: {
            type:     String,
            required: true,
            trim:     true,
        },
        description: {
            type: String,
            trim: true,
        },
        image: {
            filename: {
                type:    String,
                default: "listingimage",
            },
            url: {
                type:    String,
                default: DEFAULT_IMAGE_URL,
                set: (v) => (!v || v.trim() === "" ? DEFAULT_IMAGE_URL : v),
            },
        },
        price: {
            type: Number,
            min:  0,
        },
        location: {
            type: String,
            trim: true,
        },
        country: {
            type: String,
            trim: true,
        },
        // GeoJSON Point — populated server-side via Mapbox Geocoding API
        // when a listing is created or updated.
        // null means geocoding failed or has not run yet.
        geometry: {
            type: {
                type:  String,
                enum:  ["Point"],
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
            },
        },
        reviews: [
            {
                type: Schema.Types.ObjectId,
                ref:  "Review",
            },
        ],
        owner: {
            type: Schema.Types.ObjectId,
            ref:  "User",
        },
    },
    { timestamps: true }
);

// Full-text search index — powers fast, case-insensitive search across
// title, location and country. MongoDB uses this index for $text queries.
listingSchema.index(
    { title: "text", location: "text", country: "text" },
    {
        weights:           { title: 5, location: 3, country: 1 },
        name:              "listing_text_search",
        default_language:  "english",
    }
);

// Cascade-delete all reviews when a listing is deleted
listingSchema.post("findOneAndDelete", async (listing) => {
    if (listing && listing.reviews.length) {
        await Review.deleteMany({ _id: { $in: listing.reviews } });
    }
});

module.exports = mongoose.model("Listing", listingSchema);
