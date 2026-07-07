"use strict";

/**
 * One-time migration: convert listings that have an `images` array
 * into a single `image` object using the first element of the array.
 *
 * Safe to run multiple times — listings that already have a proper
 * `image` object and no `images` array are skipped automatically.
 *
 * Run with:  node init/migrateImages.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const mongoose = require("mongoose");

const DEFAULT_IMAGE_URL =
    "https://images.unsplash.com/photo-1720884413532-59289875c3e1" +
    "?q=80&w=735&auto=format&fit=crop&ixlib=rb-4.1.0";

const run = async () => {
    await mongoose.connect(process.env.ATLASDB_URL);
    console.log("Connected to MongoDB\n");

    const db         = mongoose.connection.db;
    const collection = db.collection("listings");

    // Find every listing that has a non-empty `images` array
    const listings = await collection
        .find({ images: { $exists: true, $not: { $size: 0 } } })
        .toArray();

    console.log(`Found ${listings.length} listing(s) with an images array to migrate.\n`);

    if (listings.length === 0) {
        console.log("Nothing to migrate — all listings already use the single-image schema.");
        await mongoose.disconnect();
        process.exit(0);
    }

    let migrated = 0;
    let skipped  = 0;

    for (const listing of listings) {
        const firstImage = listing.images[0];

        if (!firstImage || !firstImage.url) {
            console.log(`  SKIP  "${listing.title}" — images array is empty or malformed`);
            skipped++;
            continue;
        }

        // Build the new single image object from the first element
        const newImage = {
            filename: firstImage.filename || "listingimage",
            url:      firstImage.url,
        };

        await collection.updateOne(
            { _id: listing._id },
            {
                $set:   { image: newImage },
                $unset: { images: "" },      // remove the old array field
            }
        );

        console.log(`  OK    "${listing.title}" → ${newImage.url.slice(0, 60)}…`);
        migrated++;
    }

    console.log(`\nMigration complete.`);
    console.log(`  Migrated : ${migrated}`);
    console.log(`  Skipped  : ${skipped}`);

    await mongoose.disconnect();
    process.exit(0);
};

run().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
