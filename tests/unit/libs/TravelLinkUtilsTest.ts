import {buildTripPostLoginPath, extractTripID, isTravelLink} from '@libs/TravelLinkUtils';

describe('TravelLinkUtils', () => {
    describe('isTravelLink', () => {
        it('returns true for travel.expensify.com URLs', () => {
            expect(isTravelLink('https://travel.expensify.com/trips/123')).toBe(true);
            expect(isTravelLink('https://travel.expensify.com')).toBe(true);
            expect(isTravelLink('https://travel.expensify.com/')).toBe(true);
            expect(isTravelLink('https://travel.expensify.com/auth/code?authCode=abc')).toBe(true);
        });

        it('returns true for staging travel.expensify.com URLs', () => {
            expect(isTravelLink('https://staging.travel.expensify.com/trips/456')).toBe(true);
            expect(isTravelLink('https://staging.travel.expensify.com')).toBe(true);
        });

        it('returns true for expensify.com trip paths', () => {
            expect(isTravelLink('https://www.expensify.com/trips/789')).toBe(true);
            expect(isTravelLink('https://expensify.com/trips/123456')).toBe(true);
        });

        it('returns false for non-travel URLs', () => {
            expect(isTravelLink('https://google.com')).toBe(false);
            expect(isTravelLink('https://expensify.com/settings')).toBe(false);
            expect(isTravelLink('https://expensify.com')).toBe(false);
            expect(isTravelLink('https://example.com/trips/123')).toBe(false);
        });

        it('returns false for empty or invalid input', () => {
            expect(isTravelLink('')).toBe(false);
            expect(isTravelLink(null as unknown as string)).toBe(false);
            expect(isTravelLink(undefined as unknown as string)).toBe(false);
        });

        it('handles case-insensitive matching', () => {
            expect(isTravelLink('https://TRAVEL.EXPENSIFY.COM/trips/123')).toBe(true);
            expect(isTravelLink('https://Travel.Expensify.Com/TRIPS/123')).toBe(true);
        });
    });

    describe('extractTripID', () => {
        it('extracts numeric trip IDs from full URLs', () => {
            expect(extractTripID('https://travel.expensify.com/trips/12345')).toBe('12345');
            expect(extractTripID('https://staging.travel.expensify.com/trips/67890')).toBe('67890');
        });

        it('extracts trip IDs from relative paths', () => {
            expect(extractTripID('/trips/11111')).toBe('11111');
            // Note: paths without leading slash are not expected from real-world usage
            // The attachment URLs always include the full path with leading slash
        });

        it('handles trip IDs with various URL formats', () => {
            expect(extractTripID('https://travel.expensify.com/trips/123?param=value')).toBe('123');
            expect(extractTripID('https://travel.expensify.com/trips/456#section')).toBe('456');
            expect(extractTripID('https://travel.expensify.com/trips/789/')).toBe('789');
        });

        it('returns undefined for non-trip URLs', () => {
            expect(extractTripID('https://google.com')).toBeUndefined();
            expect(extractTripID('https://travel.expensify.com/settings')).toBeUndefined();
            expect(extractTripID('https://travel.expensify.com/trips/')).toBeUndefined();
        });

        it('returns undefined for empty or invalid input', () => {
            expect(extractTripID('')).toBeUndefined();
            expect(extractTripID(null as unknown as string)).toBeUndefined();
            expect(extractTripID(undefined as unknown as string)).toBeUndefined();
        });

        it('only matches numeric trip IDs', () => {
            expect(extractTripID('/trips/abc')).toBeUndefined();
            expect(extractTripID('/trips/123abc')).toBe('123');
        });

        it('handles case-insensitive paths', () => {
            expect(extractTripID('/TRIPS/12345')).toBe('12345');
            expect(extractTripID('/Trips/67890')).toBe('67890');
        });
    });

    describe('buildTripPostLoginPath', () => {
        it('returns correct path format for valid trip URLs', () => {
            expect(buildTripPostLoginPath('https://travel.expensify.com/trips/123')).toBe('trips/123');
            expect(buildTripPostLoginPath('https://staging.travel.expensify.com/trips/456')).toBe('trips/456');
        });

        it('returns correct path format for relative paths', () => {
            expect(buildTripPostLoginPath('/trips/789')).toBe('trips/789');
        });

        it('returns undefined for non-trip URLs', () => {
            expect(buildTripPostLoginPath('https://google.com')).toBeUndefined();
            expect(buildTripPostLoginPath('https://travel.expensify.com/settings')).toBeUndefined();
        });

        it('returns undefined for empty or invalid input', () => {
            expect(buildTripPostLoginPath('')).toBeUndefined();
            expect(buildTripPostLoginPath(null as unknown as string)).toBeUndefined();
        });

        it('handles URLs with query parameters', () => {
            expect(buildTripPostLoginPath('https://travel.expensify.com/trips/123?test=1')).toBe('trips/123');
        });
    });
});










