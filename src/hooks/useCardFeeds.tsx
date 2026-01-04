import {useMemo} from 'react';
import type {OnyxCollection, ResultMetadata} from 'react-native-onyx';
import {getCompanyCardFeedWithDomainID} from '@libs/CardUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import type {CardFeeds, CompanyCardFeed, CompanyCardFeedWithDomainID} from '@src/types/onyx';
import type {CustomCardFeedData, DirectCardFeedData} from '@src/types/onyx/CardFeeds';
import useOnyx from './useOnyx';
import useWorkspaceAccountID from './useWorkspaceAccountID';

type CombinedCardFeed = CustomCardFeedData &
    Partial<DirectCardFeedData> & {
        /** Custom feed name, originally coming from settings.companyCardNicknames */
        customFeedName?: string;

        /** Feed name */
        feed: CompanyCardFeed;
    };

type CombinedCardFeeds = Record<CompanyCardFeedWithDomainID, CombinedCardFeed>;

/**
 * This is a custom hook that combines workspace and domain card feeds for a given policy.
 *
 * This hook:
 * - Gets all available feeds (ONYXKEYS.COLLECTION.SHARED_NVP_PRIVATE_DOMAIN_MEMBER) from Onyx.
 * - Extracts and compiles card feeds data including only feeds where the `preferredPolicy` matches the `policyID`.
 *
 * @param policyID - The workspace policyID to filter and construct card feeds for.
 * @returns -
 *   A tuple containing:
 *     1. Combined workspace and domain card feeds specific to the given policyID (or `undefined` if unavailable).
 *     2. The result metadata from the Onyx collection fetch.
 *     3. Card feeds specific to the given policyID (or `undefined` if unavailable).
 *     4. Whether any feed is currently loading from API (isLoading flag set by openPolicyCompanyCardsPage action).
 */
const useCardFeeds = (policyID: string | undefined): [CombinedCardFeeds | undefined, ResultMetadata<OnyxCollection<CardFeeds>>, CardFeeds | undefined, boolean] => {
    const workspaceAccountID = useWorkspaceAccountID(policyID);
    const [allFeeds, allFeedsResult] = useOnyx(ONYXKEYS.COLLECTION.SHARED_NVP_PRIVATE_DOMAIN_MEMBER, {canBeMissing: true});
    const defaultFeed = allFeeds?.[`${ONYXKEYS.COLLECTION.SHARED_NVP_PRIVATE_DOMAIN_MEMBER}${workspaceAccountID}`];

    // Check if any feed is currently loading from API
    // This flag is set by openPolicyCompanyCardsPage() action via optimisticData/successData/failureData
    const isAnyFeedLoading = useMemo(() => {
        // If no feeds data at all, Onyx is still initializing
        if (!allFeeds) {
            return false;
        }

        // If workspaceAccountID is 0, the policy hasn't loaded yet - consider it loading
        // to prevent BYOC flash before we know if there are feeds
        if (workspaceAccountID === 0) {
            return true;
        }

        // Check if any feed has explicit isLoading: true flag
        const hasExplicitlyLoadingFeed = Object.values(allFeeds).some((feed) => feed?.isLoading === true);
        if (hasExplicitlyLoadingFeed) {
            return true;
        }

        // Check if the workspace-specific entry exists in allFeeds
        // If it doesn't exist yet, the initial API call hasn't completed yet
        // (the action creates this entry via optimisticData when called)
        // This handles the gap between Onyx cache load and API action being called
        const workspaceFeedKey = `${ONYXKEYS.COLLECTION.SHARED_NVP_PRIVATE_DOMAIN_MEMBER}${workspaceAccountID}`;
        const workspaceFeedEntry = allFeeds[workspaceFeedKey];

        if (!workspaceFeedEntry) {
            return true;
        }

        return false;
    }, [allFeeds, workspaceAccountID]);

    const workspaceFeeds = useMemo(() => {
        if (!policyID || !allFeeds) {
            return undefined;
        }

        const result: CombinedCardFeeds = {};

        return Object.entries(allFeeds).reduce<CombinedCardFeeds>((acc, [onyxKey, feed]) => {
            if (!feed?.settings?.companyCards) {
                return acc;
            }

            for (const [key, feedSettings] of Object.entries(feed.settings.companyCards)) {
                const feedName = key as CompanyCardFeed;
                const feedOAuthAccountDetails = feed.settings.oAuthAccountDetails?.[feedName];
                const feedCompanyCardNickname = feed.settings.companyCardNicknames?.[feedName];
                const domainID = onyxKey.split('_').at(-1);
                const shouldAddFeed = domainID && (feedSettings.preferredPolicy ? feedSettings.preferredPolicy === policyID : domainID === workspaceAccountID.toString());

                if (!shouldAddFeed) {
                    continue;
                }

                const combinedFeedKey = getCompanyCardFeedWithDomainID(feedName, domainID);

                acc[combinedFeedKey] = {
                    ...feedSettings,
                    ...feedOAuthAccountDetails,
                    customFeedName: feedCompanyCardNickname,
                    domainID: Number(domainID),
                    feed: feedName,
                };
            }

            return acc;
        }, result);
    }, [allFeeds, policyID, workspaceAccountID]);

    return [workspaceFeeds, allFeedsResult, defaultFeed, isAnyFeedLoading];
};

export default useCardFeeds;
export type {CombinedCardFeeds, CompanyCardFeedWithDomainID, CombinedCardFeed};
