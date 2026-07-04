"use strict";

/**
 * Geocode a free-text address using Nominatim (OpenStreetMap).
 * No API key or account required.
 *
 * Returns a GeoJSON Point geometry:
 *   { type: "Point", coordinates: [longitude, latitude] }
 *
 * Returns null if:
 *   - Nominatim returns no results (unrecognised location)
 *   - The network request fails for any reason
 *
 * Nominatim usage policy: max 1 req/sec, must send a User-Agent.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
const geocode = async (location, country) => {
    if (!location || !country) return null;

    const query = encodeURIComponent(`${location.trim()}, ${country.trim()}`);
    const url   = `https://nominatim.openstreetmap.org/search` +
                  `?q=${query}&format=json&limit=1`;

    try {
        const res  = await fetch(url, {
            headers: {
                // Nominatim requires a descriptive User-Agent
                "User-Agent": "Nestify/1.0 (nestify-app)",
            },
        });
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
            console.warn(`Geocoding: no results for "${location}, ${country}"`);
            return null;
        }

        const lng = parseFloat(data[0].lon);
        const lat = parseFloat(data[0].lat);

        return {
            type:        "Point",
            coordinates: [lng, lat],
        };
    } catch (err) {
        console.error("Geocoding request failed:", err.message);
        return null;
    }
};

module.exports = { geocode };
