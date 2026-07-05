"use strict";

/**
 * One-time migration: geocode all listings that have no coordinates.
 *
 * Run with:  node init/geocodeAll.js
 *
 * Nominatim rate limit is 1 req/sec — the script waits 1.1s between
 * each request to stay compliant.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const mongoose      = require("mongoose");
const Listing       = require("../models/listing.js");
const { geocode }   = require("../utils/geocode.js");

const DELAY_MS = 1100; // 1.1 s between requests — respects Nominatim policy

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
    await mongoose.connect(process.env.ATLASDB_URL);
    console.log("Connected to MongoDB\n");

    // Find every listing that has no geometry or empty coordinates
    const listings = await Listing.find({
        $or: [
            { geometry: null },
            { geometry: { $exists: false } },
            { "geometry.coordinates": { $size: 0 } },
        ],
    }).select("_id title location country geometry");

    console.log(`Found ${listings.length} listing(s) without coordinates.\n`);

    if (listings.length === 0) {
        console.log("Nothing to do — all listings already have coordinates.");
        process.exit(0);
    }

    let success = 0;
    let failed  = 0;

    for (const listing of listings) {
        process.stdout.write(`Geocoding: "${listing.title}" (${listing.location}, ${listing.country}) ... `);

        const geometry = await geocode(listing.location, listing.country);

        if (geometry) {
            await Listing.findByIdAndUpdate(listing._id, { geometry });
            console.log(`✓  [${geometry.coordinates[1].toFixed(4)}, ${geometry.coordinates[0].toFixed(4)}]`);
            success++;
        } else {
            console.log("✗  no results");
            failed++;
        }

        // Respect Nominatim rate limit
        await sleep(DELAY_MS);
    }

    console.log(`\nDone. ${success} geocoded, ${failed} failed.`);
    process.exit(0);
};

run().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
