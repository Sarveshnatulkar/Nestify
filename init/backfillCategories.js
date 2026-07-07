"use strict";

/**
 * One-time migration: assign a category to every listing that has none.
 * Run with: node init/backfillCategories.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const mongoose = require("mongoose");
const Listing  = require("../models/listing.js");

// Map a listing's title keywords → category
const inferCategory = (title = "", location = "") => {
    const t = title.toLowerCase();
    const l = location.toLowerCase();
    if (t.includes("ski") || t.includes("chalet") || t.includes("snow") || t.includes("arctic")) return "Arctic";
    if (t.includes("castle"))                return "Castle";
    if (t.includes("treehouse") || t.includes("camping") || t.includes("cabin") || t.includes("log")) return "Camping";
    if (t.includes("mountain") || t.includes("banff") || t.includes("aspen") || t.includes("alpine")) return "Mountains";
    if (t.includes("pool") || t.includes("villa") || t.includes("penthouse") || t.includes("luxury")) return "Amazing pools";
    if (t.includes("boat") || t.includes("island") || t.includes("canal"))  return "Boat";
    if (t.includes("desert") || t.includes("dubai") || l.includes("dubai")) return "Desert";
    if (t.includes("beach") || t.includes("bungalow") || t.includes("cottage") || t.includes("paradise")) return "Amazing views";
    if (t.includes("safari") || t.includes("play"))  return "Play";
    return "Rooms";
};

const run = async () => {
    await mongoose.connect(process.env.ATLASDB_URL);
    console.log("Connected\n");

    const listings = await Listing.find({ $or: [{ category: null }, { category: { $exists: false } }] });
    console.log(`${listings.length} listings need a category.\n`);

    for (const listing of listings) {
        const category = inferCategory(listing.title, listing.location);
        await Listing.findByIdAndUpdate(listing._id, { category });
        console.log(`  "${listing.title}" → ${category}`);
    }

    console.log("\nDone.");
    process.exit(0);
};

run().catch(err => { console.error(err); process.exit(1); });
