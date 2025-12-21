import CONST from '@src/CONST';

/**
 * Detects if a URL is a travel-related link that requires Spotnana authentication.
 *
 * @param url - The URL to check
 * @returns true if the URL points to travel.expensify.com or contains trip paths
 */
function isTravelLink(url: string): boolean {
    if (!url) {
        return false;
    }

    const lowerUrl = url.toLowerCase();

    // Direct travel domain links
    if (lowerUrl.includes('travel.expensify.com')) {
        return true;
    }

    // Trip-specific paths on any expensify domain
    if (lowerUrl.includes('expensify.com') && lowerUrl.includes('/trips/')) {
        return true;
    }

    return false;
}

/**
 * Extracts the trip ID from a travel URL.
 *
 * Supported formats:
 * - https://travel.expensify.com/trips/12345
 * - https://staging.travel.expensify.com/trips/67890
 * - /trips/11111
 *
 * @param url - The URL to extract from
 * @returns The trip ID or undefined if not found
 */
function extractTripID(url: string): string | undefined {
    if (!url) {
        return undefined;
    }

    // Match: /trips/{numeric_id}
    const match = url.match(/\/trips\/(\d+)/i);
    return match?.[1];
}

/**
 * Builds the postLoginPath for a trip URL.
 * Uses CONST.TRIP_ID_PATH for consistency with TripDetailsPage.
 *
 * @param url - The travel URL
 * @returns The postLoginPath (e.g., "trips/12345") or undefined
 */
function buildTripPostLoginPath(url: string): string | undefined {
    const tripID = extractTripID(url);
    return CONST.TRIP_ID_PATH(tripID);
}

export {isTravelLink, extractTripID, buildTripPostLoginPath};










