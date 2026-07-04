"use strict";

// ── Load environment variables FIRST — before any require() reads process.env
if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const express        = require("express");
const path         = require("path");
const methodOverride = require("method-override");
const ejsMate      = require("ejs-mate");
const session      = require("express-session");
const flash        = require("connect-flash");
const passport     = require("passport");

const { connect }          = require("./config/db.js");
const { buildSessionOptions } = require("./config/session.js");
const passportConfig       = require("./config/passport.js");
const ExpressError         = require("./utils/ExpressError.js");

const listingRouter = require("./routes/listing.js");
const reviewRouter  = require("./routes/review.js");
const userRouter    = require("./routes/user.js");

// ── Database ──────────────────────────────────────────────────────────────────
connect().catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
});

// ── App setup ─────────────────────────────────────────────────────────────────
const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);

// ── Request parsing ───────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// ── Session, flash, passport ──────────────────────────────────────────────────
// buildSessionOptions() is called here — after dotenv has loaded — so
// process.env.ATLASDB_URL, SECRET, and MAPBOX_TOKEN are all available.
const sessionOptions = buildSessionOptions();
app.use(session(sessionOptions));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passportConfig.initialize();

// ── Locals available to every template ───────────────────────────────────────
app.use((req, res, next) => {
    res.locals.success  = req.flash("success");
    res.locals.error    = req.flash("error");
    res.locals.currUser = req.user;
    res.locals.q        = req.query.q || "";
    next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.redirect("/listings"));
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res, next) => {
    next(new ExpressError(404, "Page not found"));
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    const { statusCode = 500, message = "Something went wrong" } = err;
    res.status(statusCode).render("error.ejs", { message });
});

// ── Server ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
