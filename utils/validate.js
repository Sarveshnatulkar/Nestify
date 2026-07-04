"use strict";

const Joi = require("joi");

// ── Listing schema ────────────────────────────────────────────────────────────
const listingSchema = Joi.object({
    listing: Joi.object({
        title: Joi.string().required()
            .messages({ "string.empty": "Title is required", "any.required": "Title is required" }),
        description: Joi.string().required()
            .messages({ "string.empty": "Description is required", "any.required": "Description is required" }),
        location: Joi.string().required()
            .messages({ "string.empty": "Location is required", "any.required": "Location is required" }),
        country: Joi.string().required()
            .messages({ "string.empty": "Country is required", "any.required": "Country is required" }),
        price: Joi.number().required().min(0)
            .messages({
                "number.base":  "Price must be a number",
                "number.min":   "Price must be 0 or greater",
                "any.required": "Price is required",
            }),
        // image arrives via multer (req.file), not req.body — optional here
        image: Joi.object({
            url:      Joi.string().allow("", null),
            filename: Joi.string().allow("", null),
        }).optional(),
    }).required(),
});

// ── Review schema ─────────────────────────────────────────────────────────────
const reviewSchema = Joi.object({
    review: Joi.object({
        rating: Joi.number().required().min(1).max(5)
            .messages({
                "number.base":  "Rating must be a number",
                "number.min":   "Rating must be at least 1",
                "number.max":   "Rating cannot exceed 5",
                "any.required": "Rating is required",
            }),
        comment: Joi.string().required()
            .messages({ "string.empty": "Comment is required", "any.required": "Comment is required" }),
    }).required(),
});

module.exports = { listingSchema, reviewSchema };
