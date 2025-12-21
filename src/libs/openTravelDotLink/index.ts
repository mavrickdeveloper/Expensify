import {openTravelDotLink as openTravelDotLinkWeb} from '@libs/actions/Link';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';

/**
 * Opens the travel portal with Spotnana authentication on web platforms.
 *
 * @param activePolicyID - The policy ID for generating the Spotnana token
 * @param postLoginPath - Optional path to redirect to after authentication (e.g., "trips/12345")
 */
const openTravelDotLink = (activePolicyID?: string, postLoginPath?: string) => {
    openTravelDotLinkWeb(activePolicyID, postLoginPath)
        ?.then(() => {})
        ?.catch(() => {
            Navigation.navigate(ROUTES.TRAVEL_MY_TRIPS.getRoute(activePolicyID));
        });
};

const shouldOpenTravelDotLinkWeb = () => true;

export {openTravelDotLink, shouldOpenTravelDotLinkWeb};
