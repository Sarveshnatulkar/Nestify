"use strict";

const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key:    process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder:          "nestify_DEV",
        allowed_formats: ["png", "jpg", "jpeg", "webp"],
        // Optimise on upload: auto quality, auto format (serves WebP/AVIF where
        // supported), strip metadata, cap at 1920px wide to save storage/bandwidth.
        transformation: [
            { width: 1920, crop: "limit" },
            { quality: "auto:good" },
            { fetch_format: "auto" },
        ],
    },
});

module.exports = { cloudinary, storage };