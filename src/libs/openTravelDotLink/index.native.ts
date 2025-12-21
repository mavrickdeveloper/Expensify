import {getTravelDotLink} from '@libs/actions/Link';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';

/**
 * Opens the travel portal with Spotnana authentication on native platforms.
 *
 * @param activePolicyID - The policy ID for generating the Spotnana token
 * @param postLoginPath - Optional path to redirect to after authentication (e.g., "trips/12345")
 */
const openTravelDotLink = (activePolicyID?: string, postLoginPath?: string) => {
    getTravelDotLink(activePolicyID)
        ?.then((response) => {
            if (response.spotnanaToken) {
                Navigation.navigate(ROUTES.TRAVEL_DOT_LINK_WEB_VIEW.getRoute(response.spotnanaToken, response.isTestAccount, postLoginPath));
                return;
            }
            Navigation.navigate(ROUTES.TRAVEL_MY_TRIPS.getRoute(activePolicyID));
        })
        ?.catch((error) => {
            console.error('Failed to get travel dot link:', error);
            Navigation.navigate(ROUTES.TRAVEL_MY_TRIPS.getRoute(activePolicyID));
        });
};

const shouldOpenTravelDotLinkWeb = () => false;

export {openTravelDotLink, shouldOpenTravelDotLinkWeb};
