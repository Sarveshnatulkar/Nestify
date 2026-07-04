"use strict";

class ExpressError extends Error {
    constructor(statusCode, message) {
        super(message);          // sets Error.message on the prototype chain
        this.statusCode = statusCode;
        this.name = "ExpressError";
    }
}

module.exports = ExpressError;
