"use strict";

const mongoose = require("mongoose");

const connect = async () => {
    const dbUrl = process.env.ATLASDB_URL;
    await mongoose.connect(dbUrl);
    console.log("Connected to MongoDB");
};

mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
});

module.exports = { connect };
