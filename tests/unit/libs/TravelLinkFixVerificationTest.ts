/**
 * Test file to verify Issue #77027 FIX is correct and works on Android
 *
 * This test verifies that:
 * 1. The utility functions correctly detect and parse travel links
 * 2. The ROUTES.TRAVEL_DOT_LINK_WEB_VIEW supports postLoginPath parameter (THE FIX)
 * 3. The end-to-end flow for Header.tsx would work correctly on Android
 */

import {buildTravelDotURL} from '@libs/actions/Link';
import {buildTripPostLoginPath, extractTripID, isTravelLink} from '@libs/TravelLinkUtils';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';

describe('Issue #77027: Travel Link FIX Verification', () => {
    describe('ROUTES.TRAVEL_DOT_LINK_WEB_VIEW - FIX VERIFICATION', () => {
        it('FIX: Route getRoute function now accepts postLoginPath as 3rd parameter', () => {
            const token = 'test-spotnana-token';
            const isTestAccount = true;
            const postLoginPath = 'trips/12345';

            // THE FIX: getRoute now accepts 3 parameters
            const route = ROUTES.TRAVEL_DOT_LINK_WEB_VIEW.getRoute(token, isTestAccount, postLoginPath);

            // Verify postLoginPath is included and properly encoded
            expect(route).toContain('postLoginPath=');
            expect(route).toContain(encodeURIComponent(postLoginPath));
        });

        it('FIX: Route correctly encodes postLoginPath with special characters', () => {
            const token = 'token';
            const postLoginPath = 'trips/123/details?foo=bar';

            const route = ROUTES.TRAVEL_DOT_LINK_WEB_VIEW.getRoute(token, false, postLoginPath);

            expect(route).toContain('postLoginPath=');
            expect(route).toContain(encodeURIComponent(postLoginPath));
            // Verify / is encoded as %2F
            expect(route).toContain('%2F');
        });

        it('FIX: Route works correctly without postLoginPath (backward compatible)', () => {
            const token = 'test-token';
            const isTestAccount = false;

            // Calling without postLoginPath should still work
            const route = ROUTES.TRAVEL_DOT_LINK_WEB_VIEW.getRoute(token, isTestAccount);

            expect(route).toBe('travel-dot-link?token=test-token&isTestAccount=false');
            expect(route).not.toContain('postLoginPath');
        });

        it('FIX: Route handles undefined postLoginPath gracefully', () => {
            const token = 'test-token';

            const route = ROUTES.TRAVEL_DOT_LINK_WEB_VIEW.getRoute(token, true, undefined);

            expect(route).toBe('travel-dot-link?token=test-token&isTestAccount=true');
            expect(route).not.toContain('postLoginPath');
        });
    });

    describe('TravelLinkUtils - Android Compatibility Verification', () => {
        describe('isTravelLink - Real URL patterns from Android attachment modal', () => {
            it('detects travel.expensify.com trip URLs (most common case)', () => {
                // These are the actual URL patterns that appear in trip receipts
                expect(isTravelLink('https://travel.expensify.com/trips/12345')).toBe(true);
                expect(isTravelLink('https://travel.expensify.com/trips/67890123')).toBe(true);
            });

            it('detects staging URLs for test accounts', () => {
                expect(isTravelLink('https://staging.travel.expensify.com/trips/999')).toBe(true);
            });

            it('detects legacy expensify.com trip paths', () => {
                // Some older trip links might use expensify.com/trips/
                expect(isTravelLink('https://www.expensify.com/trips/456')).toBe(true);
                expect(isTravelLink('https://expensify.com/trips/789')).toBe(true);
            });

            it('rejects non-travel URLs that should open in external browser', () => {
                expect(isTravelLink('https://google.com')).toBe(false);
                expect(isTravelLink('https://expensify.com/settings')).toBe(false);
                expect(isTravelLink('https://example.com/trips/123')).toBe(false);
                expect(isTravelLink('')).toBe(false);
            });
        });

        describe('extractTripID - Parsing trip IDs from various URL formats', () => {
            it('extracts trip ID from standard travel.expensify.com URLs', () => {
                expect(extractTripID('https://travel.expensify.com/trips/12345')).toBe('12345');
                expect(extractTripID('https://staging.travel.expensify.com/trips/67890')).toBe('67890');
            });

            it('handles URLs with query parameters', () => {
                expect(extractTripID('https://travel.expensify.com/trips/123?utm_source=email')).toBe('123');
                expect(extractTripID('https://travel.expensify.com/trips/456#section')).toBe('456');
            });

            it('handles very long trip IDs', () => {
                expect(extractTripID('https://travel.expensify.com/trips/1234567890123456')).toBe('1234567890123456');
            });

            it('returns undefined for malformed trip URLs', () => {
                expect(extractTripID('https://travel.expensify.com/trips/')).toBeUndefined();
                expect(extractTripID('https://travel.expensify.com/trips/abc')).toBeUndefined();
                expect(extractTripID('https://travel.expensify.com/settings')).toBeUndefined();
            });
        });

        describe('buildTripPostLoginPath - Building redirect paths', () => {
            it('builds correct postLoginPath for trip URLs', () => {
                expect(buildTripPostLoginPath('https://travel.expensify.com/trips/123')).toBe('trips/123');
                expect(buildTripPostLoginPath('https://staging.travel.expensify.com/trips/456')).toBe('trips/456');
            });

            it('returns undefined for non-trip travel URLs', () => {
                // travel.expensify.com without /trips/ path
                expect(buildTripPostLoginPath('https://travel.expensify.com')).toBeUndefined();
                expect(buildTripPostLoginPath('https://travel.expensify.com/settings')).toBeUndefined();
            });
        });
    });

    describe('End-to-End Flow Verification (Android Native)', () => {
        it('verifies complete flow: Trip URL -> postLoginPath -> Authenticated URL', () => {
            // Step 1: User clicks "View Trip" link in attachment modal
            // The subTitleLink prop contains the travel URL
            const subTitleLink = 'https://travel.expensify.com/trips/12345';

            // Step 2: Header.tsx checks if it's a travel link
            expect(isTravelLink(subTitleLink)).toBe(true);

            // Step 3: Build the postLoginPath for redirection
            const postLoginPath = buildTripPostLoginPath(subTitleLink);
            expect(postLoginPath).toBe('trips/12345');

            // Step 4: openTravelDotLink is called, which calls getTravelDotLink API
            // Simulate API response with Spotnana token
            const mockSpotnanaToken = 'spotnana-token-abc123';
            const isTestAccount = false;

            // Step 5: Native code navigates to TRAVEL_DOT_LINK_WEB_VIEW route
            const route = ROUTES.TRAVEL_DOT_LINK_WEB_VIEW.getRoute(mockSpotnanaToken, isTestAccount, postLoginPath);
            expect(route).toBe('travel-dot-link?token=spotnana-token-abc123&isTestAccount=false&postLoginPath=trips%2F12345');

            // Step 6: TravelDotLinkWebview extracts params and builds final URL
            // Simulating what TravelDotLinkWebview does
            const decodedPostLoginPath = decodeURIComponent('trips%2F12345');
            expect(decodedPostLoginPath).toBe('trips/12345');

            const finalUrl = buildTravelDotURL(mockSpotnanaToken, isTestAccount, decodedPostLoginPath);

            // Step 7: Verify the final URL is correct
            expect(finalUrl).toContain('travel.expensify.com');
            expect(finalUrl).toContain('authCode=spotnana-token-abc123');
            expect(finalUrl).toContain('redirectUrl=/trips/12345');
        });

        it('verifies flow with staging (test account)', () => {
            const subTitleLink = 'https://staging.travel.expensify.com/trips/99999';

            expect(isTravelLink(subTitleLink)).toBe(true);

            const postLoginPath = buildTripPostLoginPath(subTitleLink);
            expect(postLoginPath).toBe('trips/99999');

            const mockToken = 'test-token';
            const isTestAccount = true;

            const finalUrl = buildTravelDotURL(mockToken, isTestAccount, postLoginPath);

            expect(finalUrl).toContain('staging.travel.expensify.com');
            expect(finalUrl).toContain('authCode=test-token');
            expect(finalUrl).toContain('redirectUrl=/trips/99999');
        });

        it('verifies fallback: non-trip travel link opens without redirect', () => {
            // If someone has a travel.expensify.com link without a trip ID
            const subTitleLink = 'https://travel.expensify.com';

            expect(isTravelLink(subTitleLink)).toBe(true);

            const postLoginPath = buildTripPostLoginPath(subTitleLink);
            expect(postLoginPath).toBeUndefined();

            // Without postLoginPath, the route won't include it
            const route = ROUTES.TRAVEL_DOT_LINK_WEB_VIEW.getRoute('token', false, postLoginPath);
            expect(route).not.toContain('postLoginPath');

            // Final URL won't have redirectUrl
            const finalUrl = buildTravelDotURL('token', false, postLoginPath);
            expect(finalUrl).not.toContain('redirectUrl');
        });

        it('verifies non-travel links are NOT intercepted (falls back to Linking.openURL)', () => {
            const regularLinks = [
                'https://google.com',
                'https://expensify.com/settings',
                'https://example.com/trips/123', // different domain
            ];

            regularLinks.forEach((link) => {
                expect(isTravelLink(link)).toBe(false);
                // When isTravelLink is false, Header.tsx uses Linking.openURL()
                // which opens the URL in the default browser - this is correct behavior
            });
        });
    });

    describe('CONST.TRIP_ID_PATH - Consistency Verification', () => {
        it('matches format used in TripDetailsPage.tsx', () => {
            // TripDetailsPage.tsx uses: CONST.TRIP_ID_PATH(tripID)
            // We use the same in buildTripPostLoginPath
            expect(CONST.TRIP_ID_PATH('123')).toBe('trips/123');
            expect(CONST.TRIP_ID_PATH('999999')).toBe('trips/999999');
        });

        it('returns undefined for undefined/falsy tripID', () => {
            expect(CONST.TRIP_ID_PATH(undefined)).toBeUndefined();
            expect(CONST.TRIP_ID_PATH('')).toBeUndefined();
        });
    });
});




