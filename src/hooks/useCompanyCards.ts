import {useEffect, useRef} from 'react';
import type {OnyxCollection, OnyxEntry, ResultMetadata} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import {getCompanyCardFeed, getCompanyFeeds, getPlaidInstitutionId, getSelectedFeed} from '@libs/CardUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {CardFeeds, CardList} from '@src/types/onyx';
import type {AssignableCardsList, WorkspaceCardsList} from '@src/types/onyx/Card';
import type {CompanyCardFeed, CompanyCardFeedWithDomainID, CompanyFeeds} from '@src/types/onyx/CardFeeds';
import useCardFeeds from './useCardFeeds';
import type {CombinedCardFeed, CombinedCardFeeds} from './useCardFeeds';
import useCardsList from './useCardsList';
import useOnyx from './useOnyx';

type CardFeedType = ValueOf<typeof CONST.COMPANY_CARDS.FEED_TYPE>;

type UseCompanyCardsProps = {
    policyID: string | undefined;
    feedName?: CompanyCardFeedWithDomainID;
};

type UsCompanyCardsResult = Partial<{
    cardFeedType: CardFeedType;
    bankName: CompanyCardFeed;
    feedName: CompanyCardFeedWithDomainID;
    cardList: AssignableCardsList;
    assignedCards: CardList;
    cardNames: string[];
    allCardFeeds: CombinedCardFeeds;
    companyCardFeeds: CompanyFeeds;
    selectedFeed: CombinedCardFeed;
}> & {
    onyxMetadata: {
        cardListMetadata: ResultMetadata<WorkspaceCardsList>;
        allCardFeedsMetadata: ResultMetadata<OnyxCollection<CardFeeds>>;
        lastSelectedFeedMetadata: ResultMetadata<OnyxEntry<CompanyCardFeedWithDomainID>>;
    };
};

function useCompanyCards({policyID, feedName: feedNameProp}: UseCompanyCardsProps): UsCompanyCardsResult {
    const [lastSelectedFeed, lastSelectedFeedMetadata] = useOnyx(`${ONYXKEYS.COLLECTION.LAST_SELECTED_FEED}${policyID}`, {canBeMissing: true});
    const [allCardFeeds, allCardFeedsMetadata] = useCardFeeds(policyID);

    // Track recently deleted feeds to prevent stale API responses from restoring them.
    // This ref persists across renders and remembers feeds that were deleted, even after pendingAction is cleared.
    const recentlyDeletedFeedsRef = useRef<Set<string>>(new Set());

    // Track feeds that are currently being deleted (pendingAction === DELETE).
    // When a feed enters DELETE state, we add it to recentlyDeletedFeedsRef.
    // When a feed is completely removed from allCardFeeds, we can clear it from the ref.
    useEffect(() => {
        if (!allCardFeeds) {
            return;
        }

        // Find feeds currently being deleted
        const feedsBeingDeleted = Object.entries(allCardFeeds)
            .filter(([, feed]) => feed?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE)
            .map(([key]) => key);

        // Add newly detected deleting feeds to our tracking set
        feedsBeingDeleted.forEach((feedKey) => {
            recentlyDeletedFeedsRef.current.add(feedKey);
        });

        // Clean up: remove feeds from tracking that are truly gone (not in allCardFeeds at all)
        // This allows re-adding a feed with the same name later
        recentlyDeletedFeedsRef.current.forEach((deletedFeedKey) => {
            if (!(deletedFeedKey in allCardFeeds)) {
                recentlyDeletedFeedsRef.current.delete(deletedFeedKey);
            }
        });
    }, [allCardFeeds]);

    const rawFeedName = feedNameProp ?? getSelectedFeed(lastSelectedFeed, allCardFeeds);

    // Validate that the selected feed:
    // 1. Actually exists in allCardFeeds
    // 2. Is NOT currently being deleted (pendingAction === DELETE)
    // 3. Was NOT recently deleted (tracked in recentlyDeletedFeedsRef)
    // This prevents stale API responses from briefly restoring a deleted feed.
    const wasRecentlyDeleted = rawFeedName ? recentlyDeletedFeedsRef.current.has(rawFeedName) : false;
    const feedExistsAndNotDeleted = rawFeedName && allCardFeeds?.[rawFeedName] && !wasRecentlyDeleted && allCardFeeds[rawFeedName]?.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE;
    const feedName = feedExistsAndNotDeleted ? rawFeedName : undefined;

    const bankName = feedName ? getCompanyCardFeed(feedName) : undefined;

    const [cardsList, cardListMetadata] = useCardsList(feedName);

    const companyCardFeeds = getCompanyFeeds(allCardFeeds);
    const selectedFeed = feedName && companyCardFeeds[feedName];
    const isPlaidCardFeed = !!getPlaidInstitutionId(feedName);

    // Direct feeds include Plaid feeds and OAuth feeds (like oauth.chase.com) that have accountList
    const isDirectFeed = isPlaidCardFeed || !!selectedFeed?.accountList;
    let cardFeedType: CardFeedType = 'customFeed';
    if (isDirectFeed) {
        cardFeedType = 'directFeed';
    }

    const {cardList, ...assignedCards} = cardsList ?? {};
    const cardNames = cardFeedType === 'directFeed' ? (selectedFeed?.accountList ?? []) : Object.keys(cardList ?? {});

    const onyxMetadata = {
        cardListMetadata,
        allCardFeedsMetadata,
        lastSelectedFeedMetadata,
    };

    if (!policyID) {
        return {onyxMetadata};
    }

    return {allCardFeeds, feedName, companyCardFeeds, cardList, assignedCards, cardNames, selectedFeed, bankName, cardFeedType, onyxMetadata};
}

export default useCompanyCards;
