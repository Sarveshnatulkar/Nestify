"use strict";

const MongoStore = require("connect-mongo");

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Build and return the session options object.
 * Must be called AFTER dotenv has loaded so process.env values are available.
 */
const buildSessionOptions = () => {
    const store = MongoStore.create({
        mongoUrl: process.env.ATLASDB_URL,
        crypto: {
            secret: process.env.SECRET,
        },
        touchAfter: 24 * 3600,
    });

    store.on("error", (err) => {
        console.error("ERROR in Mongo Session Store:", err);
    });

    return {
        store,
        secret:            process.env.SECRET,
        resave:            false,
        saveUninitialized: false,
        cookie: {
            maxAge:   MS_PER_WEEK,
            httpOnly: true,
        },
    };
};

module.exports = { buildSessionOptions };
