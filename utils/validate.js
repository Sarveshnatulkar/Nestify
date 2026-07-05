"use strict";

const Joi          = require("joi");
const ExpressError = require("./ExpressError.js");

// ── Listing schema ────────────────────────────────────────────────────────────
const CATEGORIES = [
    "Rooms", "Amazing views", "Castle", "Camping", "Mountains",
    "Amazing pools", "Arctic", "Desert", "Boat", "Play",
];

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
        category: Joi.string().valid(...CATEGORIES).optional()
            .messages({ "any.only": "Invalid category selected" }),
        // images arrive via multer (req.files), not req.body — ignore here
        image:  Joi.any().optional(),
        images: Joi.any().optional(),
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

// ── File upload validation middleware ─────────────────────────────────────────
const ALLOWED_MIME   = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE  = 8 * 1024 * 1024;  // 8 MB per file
const MAX_FILE_COUNT = 5;

const validateFiles = (req, res, next) => {
    const files = req.files || (req.file ? [req.file] : []);

    if (files.length > MAX_FILE_COUNT) {
        return next(new ExpressError(400,
            `You can upload a maximum of ${MAX_FILE_COUNT} images.`));
    }

    for (const file of files) {
        if (!ALLOWED_MIME.includes(file.mimetype)) {
            return next(new ExpressError(400,
                `"${file.originalname}" is not an allowed file type. Use JPG, PNG, or WebP.`));
        }
        if (file.size > MAX_FILE_SIZE) {
            return next(new ExpressError(400,
                `"${file.originalname}" exceeds the 8 MB size limit.`));
        }
    }

    next();
};

// ── Single export — no duplicate module.exports ───────────────────────────────
module.exports = { listingSchema, reviewSchema, validateFiles };
