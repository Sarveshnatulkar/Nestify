"use strict";

const MongoStore = require("connect-mongo");

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Build and return the session options object.
 * Must be called AFTER dotenv has loaded so process.env values are available.
 */
const buildSessionOptions = () => {
    const store = MongoStore.create({
        mongoUrl:   process.env.ATLASDB_URL,
        crypto:     { secret: process.env.SECRET },
        touchAfter: 24 * 3600,
    });

    store.on("error", (err) => {
        console.error("ERROR in Mongo Session Store:", err);
    });

    const isProduction = process.env.NODE_ENV === "production";

    return {
        store,
        secret:            process.env.SECRET,
        resave:            false,
        saveUninitialized: false,
        name:              "nestify.sid",     // don't expose the default 'connect.sid' name
        cookie: {
            maxAge:   MS_PER_WEEK,
            httpOnly: true,                   // not accessible via document.cookie
            secure:   isProduction,           // HTTPS only in production
            sameSite: "lax",                  // protects against most CSRF via navigation
        },
    };
};

module.exports = { buildSessionOptions };
