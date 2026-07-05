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
        // Array of uploaded images. First image is the cover/hero.
        images: {
            type: [
                {
                    filename: { type: String, required: true },
                    url:      { type: String, required: true },
                },
            ],
            default: [],
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
        category: {
            type:    String,
            enum:    ["Rooms", "Amazing views", "Castle", "Camping", "Mountains",
                      "Amazing pools", "Arctic", "Desert", "Boat", "Play"],
            default: "Rooms",
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
    { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Backward-compatible virtual — existing templates use listing.image.url
// Returns the first image, or the default placeholder if none uploaded.
listingSchema.virtual("image").get(function () {
    if (this.images && this.images.length > 0) return this.images[0];
    return { filename: "listingimage", url: DEFAULT_IMAGE_URL };
});

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
