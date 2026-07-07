"use strict";

// ── Load environment variables FIRST — before any require() reads process.env
if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}


const express         = require("express");
const path            = require("path");
const methodOverride  = require("method-override");
const ejsMate         = require("ejs-mate");
const session         = require("express-session");
const flash           = require("connect-flash");
const passport        = require("passport");
const helmet          = require("helmet");
const mongoSanitize   = require("express-mongo-sanitize");
const rateLimit       = require("express-rate-limit");
const compression     = require("compression");

const { connect }             = require("./config/db.js");
const { buildSessionOptions } = require("./config/session.js");
const passportConfig          = require("./config/passport.js");
const ExpressError            = require("./utils/ExpressError.js");
// Require User at module level — not inside a per-request callback
const User                    = require("./models/user.js");

const listingRouter  = require("./routes/listing.js");
const reviewRouter   = require("./routes/review.js");
const userRouter     = require("./routes/user.js");
const wishlistRouter = require("./routes/wishlist.js");

// ── Warn on obviously weak secrets at startup ─────────────────────────────────
if (!process.env.SECRET || process.env.SECRET.length < 20) {
    console.warn("WARNING: SESSION_SECRET is missing or too short. Set a strong random value in .env");
}

// ── Database ──────────────────────────────────────────────────────────────────
connect().catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
});

// ── App setup ─────────────────────────────────────────────────────────────────
const app = express();
app.set("trust proxy", 1);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);

// ── App-level defaults for every template render (including ejs-mate layouts) ─
// ejs-mate renders the layout in its own EJS scope. Variables set only via
// res.locals are NOT guaranteed to be in scope inside layout include() calls.
// app.locals ARE always merged into every render — so we set safe defaults here.
// The per-request middleware below overrides these with real values each request.
app.locals.currUser    = null;
app.locals.success     = [];
app.locals.error       = [];
app.locals.q           = "";
app.locals.wishlistIds = new Set();

// ── Compression — must be first middleware to take effect on all responses ────
app.use(compression());

// ── Security headers via Helmet ───────────────────────────────────────────────
// Configure CSP to allow our CDN sources (Bootstrap, FontAwesome, Leaflet, Fonts)
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc:  ["'self'"],
                scriptSrc:   [
                    "'self'",
                    "https://cdn.jsdelivr.net",
                    "https://unpkg.com",
                    // Allow inline scripts used by EJS templates (map init, flash dismiss)
                    "'unsafe-inline'",
                ],
                styleSrc:    [
                    "'self'",
                    "https://cdn.jsdelivr.net",
                    "https://cdnjs.cloudflare.com",
                    "https://fonts.googleapis.com",
                    "https://unpkg.com",
                    "'unsafe-inline'",  // Bootstrap and our own CSS use inline styles
                ],
                fontSrc:     [
                    "'self'",
                    "https://fonts.gstatic.com",
                    "https://cdnjs.cloudflare.com",
                ],
                imgSrc: [
                    "'self'",
                    "data:",
                    "blob:",
                    "https://res.cloudinary.com",
                    "https://images.unsplash.com",
                    "https://plus.unsplash.com",
                    "https://tile.openstreetmap.org",
                    "https://*.tile.openstreetmap.org",
                ],
                connectSrc: [
                    "'self'",
                    "https://nominatim.openstreetmap.org",
                    "https://tile.openstreetmap.org",
                    "https://*.tile.openstreetmap.org"
                ],
                workerSrc:   ["'self'", "blob:"],
                frameSrc:    ["'none'"],
                objectSrc:   ["'none'"],
                upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
            },
        },
        // Don't set HSTS in development — it would force HTTPS on localhost
        hsts: process.env.NODE_ENV === "production",
    })
);

// ── Rate limiting — protect auth routes from brute force ──────────────────────
const authLimiter = rateLimit({
    windowMs:         15 * 60 * 1000, // 15 minutes
    max:              20,              // 20 attempts per window per IP
    standardHeaders:  true,
    legacyHeaders:    false,
    message:          "Too many attempts from this IP, please try again after 15 minutes.",
    skip:             (req) => process.env.NODE_ENV === "development", // skip in dev
});

// General limiter for all routes — prevents DoS
const generalLimiter = rateLimit({
    windowMs:         60 * 1000, // 1 minute
    max:              200,        // 200 requests per minute per IP
    standardHeaders:  true,
    legacyHeaders:    false,
    skip:             (req) => process.env.NODE_ENV === "development",
});

app.use(generalLimiter);

// ── Request parsing ───────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

// ── Sanitise MongoDB operators from req.body / req.query / req.params ─────────
// Prevents NoSQL injection attacks like { "$gt": "" }
// app.use(mongoSanitize());

// ── Static files with cache headers ──────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public"), {
    maxAge: process.env.NODE_ENV === "production" ? "7d" : 0,
    etag:   true,
}));

// ── Session, flash, passport ──────────────────────────────────────────────────
const sessionOptions = buildSessionOptions();
app.use(session(sessionOptions));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passportConfig.initialize();

// ── Locals available to every template ───────────────────────────────────────
app.use(async (req, res, next) => {
    // Set synchronous locals FIRST — these must always be available, even if
    // the async DB call below throws. The error handler renders boilerplate.ejs
    // which includes navbar.ejs, so currUser/success/error must be set before
    // any possibility of an error being forwarded.
    res.locals.success     = req.flash("success");
    res.locals.error       = req.flash("error");
    res.locals.currUser    = req.user || null;
    res.locals.q           = req.query.q || "";
    res.locals.wishlistIds = new Set();

    // Async: populate wishlist IDs for logged-in users only
    if (req.user) {
        try {
            const u = await User.findById(req.user._id).select("wishlist").lean();
            if (u && u.wishlist) {
                res.locals.wishlistIds = new Set(u.wishlist.map((id) => id.toString()));
            }
        } catch (err) {
            // Non-fatal — wishlist heart state just won't show; log and continue
            console.error("Failed to load wishlist IDs:", err.message);
        }
    }

    next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.redirect("/listings"));
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/wishlist", wishlistRouter);

// Apply stricter rate limit to auth endpoints
app.use("/login",  authLimiter);
app.use("/signup", authLimiter);
app.use("/", userRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res, next) => {
    next(new ExpressError(404, "Page not found"));
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error("========== FULL ERROR ==========");
    console.error(err);
    console.error(err.stack);
    console.error("================================");

    const statusCode = err.statusCode || 500;
    const message = err.message || "Something went wrong";

    res.status(statusCode).render("error.ejs", { message });
});

// ── Server ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
