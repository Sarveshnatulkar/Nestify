"use strict";

const mongoose = require("mongoose");

const { Schema } = mongoose;

const reviewSchema = new Schema(
    {
        comment: {
            type: String,
            trim: true,
        },
        rating: {
            type: Number,
            min:  1,
            max:  5,
        },
        author: {
            type: Schema.Types.ObjectId,
            ref:  "User",
        },
    },
    { timestamps: true }   // adds createdAt + updatedAt automatically
);

module.exports = mongoose.model("Review", reviewSchema);
