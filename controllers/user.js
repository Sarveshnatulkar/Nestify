"use strict";

const User = require("../models/user.js");

// GET /signup
module.exports.renderSignupForm = (req, res) => {
    res.render("users/signup.ejs");
};

// POST /signup
module.exports.signup = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;
        const newUser        = new User({ email, username });
        const registeredUser = await User.register(newUser, password);
        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash("success", "Welcome to Nestify!");
            res.redirect("/listings");
        });
    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/signup");
    }
};

// GET /login
module.exports.renderLoginForm = (req, res) => {
    res.render("users/login.ejs");
};

// POST /login  (called after passport.authenticate succeeds)
module.exports.login = (req, res) => {
    req.flash("success", "Welcome back to Nestify!");
    const redirectUrl = res.locals.redirectUrl || "/listings";
    res.redirect(redirectUrl);
};

// GET /logout
module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.flash("success", "You have been logged out.");
        res.redirect("/listings");
    });
};
