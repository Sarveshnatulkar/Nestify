"use strict";

const mongoose              = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const { Schema } = mongoose;

const userSchema = new Schema(
    {
        email: {
            type:     String,
            required: true,
            unique:   true,
            trim:     true,
            lowercase: true,
        },
    },
    { timestamps: true }
);

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
