import type {ListRenderItemInfo} from '@shopify/flash-list';
import React, {useEffect, useRef, useState} from 'react';
import {View} from 'react-native';
import CardFeedIcon from '@components/CardFeedIcon';
import ScrollView from '@components/ScrollView';
import TableRowSkeleton from '@components/Skeletons/TableRowSkeleton';
import Table from '@components/Table';
import type {ActiveSorting, CompareItemsCallback, FilterConfig, IsItemInFilterCallback, IsItemInSearchCallback, TableColumn, TableHandle} from '@components/Table';
import useCompanyCards from '@hooks/useCompanyCards';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useOnyx from '@hooks/useOnyx';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import {getDomainOrWorkspaceAccountID, isMaskedCardNumberEqual} from '@libs/CardUtils';
import tokenizedSearch from '@libs/tokenizedSearch';
import WorkspaceCompanyCardPageEmptyState from '@pages/workspace/companyCards/WorkspaceCompanyCardPageEmptyState';
import WorkspaceCompanyCardsFeedAddedEmptyPage from '@pages/workspace/companyCards/WorkspaceCompanyCardsFeedAddedEmptyPage';
import WorkspaceCompanyCardsFeedPendingPage from '@pages/workspace/companyCards/WorkspaceCompanyCardsFeedPendingPage';
import variables from '@styles/variables';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Card, Policy} from '@src/types/onyx';
import isLoadingOnyxValue from '@src/types/utils/isLoadingOnyxValue';
import WorkspaceCompanyCardsTableHeaderButtons from './WorkspaceCompanyCardsTableHeaderButtons';
import WorkspaceCompanyCardTableItem from './WorkspaceCompanyCardsTableItem';
import type {WorkspaceCompanyCardTableItemData} from './WorkspaceCompanyCardsTableItem';

type CompanyCardsTableColumnKey = 'member' | 'card' | 'customCardName';

type WorkspaceCompanyCardsTableProps = {
    /** Current policy */
    policy: Policy | undefined;

    /** On assign card callback */
    onAssignCard: (cardID: string) => void;

    /** Whether to disable assign card button */
    isAssigningCardDisabled: boolean;
};

function WorkspaceCompanyCardsTable({policy, onAssignCard, isAssigningCardDisabled}: WorkspaceCompanyCardsTableProps) {
    const styles = useThemeStyles();
    const {isOffline} = useNetwork();
    const {translate, localeCompare} = useLocalize();
    const {shouldUseNarrowLayout, isMediumScreenWidth} = useResponsiveLayout();

    const {
        feedName,
        cardList,
        assignedCards,
        cardNames,
        cardFeedType,
        selectedFeed,
        allCardFeeds,
        isAPILoading,
        onyxMetadata: {cardListMetadata, lastSelectedFeedMetadata, allCardFeedsMetadata},
    } = useCompanyCards({policyID: policy?.id});
    const isDirectCardFeed = cardFeedType === 'directFeed';

    const workspaceAccountID = policy?.workspaceAccountID ?? CONST.DEFAULT_NUMBER_ID;
    const domainOrWorkspaceAccountID = getDomainOrWorkspaceAccountID(workspaceAccountID, selectedFeed);
    const [countryByIp] = useOnyx(ONYXKEYS.COUNTRY, {canBeMissing: false});
    const [personalDetails, personalDetailsMetadata] = useOnyx(ONYXKEYS.PERSONAL_DETAILS_LIST, {canBeMissing: false});
    const [customCardNames] = useOnyx(ONYXKEYS.NVP_EXPENSIFY_COMPANY_CARDS_CUSTOM_NAMES, {canBeMissing: true});
    const [failedCompanyCardAssignments] = useOnyx(`${ONYXKEYS.COLLECTION.FAILED_COMPANY_CARDS_ASSIGNMENTS}${domainOrWorkspaceAccountID}_${feedName ?? ''}`, {canBeMissing: true});

    const hasNoAssignedCard = Object.keys(assignedCards ?? {}).length === 0;
    const isInitiallyLoadingFeeds = isLoadingOnyxValue(allCardFeedsMetadata);

    // ============ FEED EXISTENCE CHECKS ============

    // Check if there are any feeds in the data
    const hasAnyFeeds = allCardFeeds && Object.keys(allCardFeeds).length > 0;

    // Track if we've ever seen feeds in this component's lifecycle
    // Used to detect "transitioning to no feeds" (deletion of last feed)
    const [everHadFeeds, setEverHadFeeds] = useState(false);

    useEffect(() => {
        if (!hasAnyFeeds && !selectedFeed) {
            return;
        }
        if (everHadFeeds) {
            return;
        }
        setEverHadFeeds(true);
    }, [hasAnyFeeds, selectedFeed, everHadFeeds]);

    // Derive "has seen feeds" by combining persistent state with current values
    const hasSeenFeeds = everHadFeeds || !!hasAnyFeeds || !!selectedFeed;

    // ============ DELETION DETECTION (Using Onyx pendingAction) ============

    // Check if the selected feed is being deleted
    const isSelectedFeedBeingDeleted = selectedFeed?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE;

    // Check if ANY feed is being deleted
    const isAnyFeedBeingDeleted = !!hasAnyFeeds && Object.values(allCardFeeds ?? {}).some(
        (feed) => feed?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE
    );

    // Check if ALL remaining feeds are being deleted (last feed deletion)
    const isAllFeedsBeingDeleted = !!hasAnyFeeds && Object.values(allCardFeeds ?? {}).every(
        (feed) => feed?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE
    );

    // ============ TRANSITION DETECTION (State-based, No Timeouts) ============

    // Detect transition to BYOC (no feeds state)
    // True when: we previously had feeds but now have none, OR all feeds are being deleted
    const isTransitioningToNoFeeds = (hasSeenFeeds && !hasAnyFeeds && !selectedFeed) || isAllFeedsBeingDeleted;

    // Detect transition between feeds (deleting one but others remain)
    // When this is true, we skip loading states because the next feed's data is already cached
    const isTransitioningBetweenFeeds = isAnyFeedBeingDeleted && !isAllFeedsBeingDeleted;

    // ============ CONFIRMED NO FEEDS CHECK ============

    // Check if we have CONFIRMED no feeds exist (not just stale cache)
    // This is true when:
    // 1. Not loading feeds metadata (Onyx subscription settled)
    // 2. Not loading from API (initial fetch completed)
    // 3. No feeds in data
    const isConfirmedNoFeeds = !isInitiallyLoadingFeeds && !isAPILoading && !hasAnyFeeds;

    // ============ UPDATED STATE CALCULATIONS ============

    // isNoFeed: Show empty state (BYOC) when:
    // 1. No selected feed
    // 2. Not loading feeds metadata
    // 3. No feeds in data
    // 4. NOT loading from API (prevents BYOC flash during initial API call)
    // 5. OR when transitioning to no feeds (immediate BYOC on last feed deletion)
    const isNoFeed = (!selectedFeed && !isInitiallyLoadingFeeds && !hasAnyFeeds && !isAPILoading) || isTransitioningToNoFeeds;

    const isFeedPending = !!selectedFeed?.pending;

    // isLoadingFeed: Updated to skip lastSelectedFeedMetadata check when appropriate
    // - Skip during deletion (trust optimistic update)
    // - Skip when confirmed no feeds exist (nothing to load for lastSelectedFeed)
    const isLoadingFeed = (!feedName && isInitiallyLoadingFeeds) ||
        policy?.id === undefined ||
        (!isAnyFeedBeingDeleted && !isConfirmedNoFeeds && isLoadingOnyxValue(lastSelectedFeedMetadata));

    const isLoadingCards = cardFeedType === 'directFeed' ? selectedFeed?.accountList === undefined : isLoadingOnyxValue(cardListMetadata) || cardList === undefined;

    // isLoadingPage: Updated to include proper guards
    // - Skip when transitioning to no feeds → go directly to BYOC
    // - Skip when transitioning between feeds → next feed already cached
    // - Skip when feed is pending → show pending page directly
    // - Include isInitiallyLoadingFeeds to prevent GAP (Bug 7)
    // - Include isAPILoading to prevent BYOC flash (Bug 6)
    const isLoadingPage = !isOffline &&
        !isTransitioningToNoFeeds &&
        !isTransitioningBetweenFeeds &&
        !isFeedPending &&
        (isLoadingFeed || isLoadingOnyxValue(personalDetailsMetadata) || !!isAPILoading || isInitiallyLoadingFeeds);

    // showCards: Updated with all necessary guards
    // - hasAnyFeeds: No feeds means no cards to show
    // - !isSelectedFeedBeingDeleted: Don't show cards for feed being deleted (prevents ListEmptyComponent skeleton)
    // - !isLoadingPage: Prevent dual rendering (skeleton AND cards)
    const showCards = !!hasAnyFeeds &&
        !isSelectedFeedBeingDeleted &&
        !isInitiallyLoadingFeeds &&
        !isFeedPending &&
        !isNoFeed &&
        !isLoadingFeed &&
        !isLoadingPage;

    const showTableControls = showCards && !!selectedFeed && !isLoadingCards;

    // Debug logging
    console.log('[WorkspaceCompanyCardsTable] State:', {
        hasAnyFeeds,
        hasSeenFeeds,
        isSelectedFeedBeingDeleted,
        isAnyFeedBeingDeleted,
        isAllFeedsBeingDeleted,
        isTransitioningToNoFeeds,
        isTransitioningBetweenFeeds,
        isConfirmedNoFeeds,
        isNoFeed,
        isFeedPending,
        isLoadingFeed,
        isLoadingPage,
        isAPILoading,
        showCards,
    });

    const isGB = countryByIp === CONST.COUNTRY.GB;
    const shouldShowGBDisclaimer = isGB && (isNoFeed || hasNoAssignedCard);

    // When we reach the medium screen width or the narrow layout is active,
    // we want to hide the table header and the middle column of the card rows, so that the content is not overlapping.
    const shouldUseNarrowTableLayout = shouldUseNarrowLayout || isMediumScreenWidth;

    const tableRef = useRef<TableHandle<WorkspaceCompanyCardTableItemData, CompanyCardsTableColumnKey>>(null);

    const columns: Array<TableColumn<CompanyCardsTableColumnKey>> = [
        {
            key: 'member',
            label: translate('common.member'),
        },
        {
            key: 'card',
            label: translate('workspace.companyCards.card'),
        },
        {
            key: 'customCardName',
            label: translate('workspace.companyCards.cardName'),
            styling: {
                containerStyles: [styles.justifyContentEnd, styles.pr3],
            },
        },
    ];

    const cardsData: WorkspaceCompanyCardTableItemData[] = isLoadingCards
        ? []
        : (cardNames?.map((cardName) => {
              const assignedCardPredicate = (card: Card) => (isDirectCardFeed ? card.cardName === cardName : isMaskedCardNumberEqual(card.cardName, cardName));

              const assignedCard = Object.values(assignedCards ?? {}).find(assignedCardPredicate);

              const failedCompanyCardAssignment = failedCompanyCardAssignments?.[cardName];

              const cardholder = assignedCard?.accountID ? personalDetails?.[assignedCard.accountID] : undefined;

              const customCardName = assignedCard?.cardID ? customCardNames?.[assignedCard.cardID] : undefined;

              const isCardDeleted = assignedCard?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE;

              const isAssigned = !!assignedCard;

              return {cardName, customCardName, isCardDeleted, isAssigned, assignedCard, cardholder, failedCompanyCardAssignment};
          }) ?? []);

    const keyExtractor = (item: WorkspaceCompanyCardTableItemData, index: number) => `${item.cardName}_${index}`;

    const compareItems: CompareItemsCallback<WorkspaceCompanyCardTableItemData, CompanyCardsTableColumnKey> = (a, b, activeSorting) => {
        const orderMultiplier = activeSorting.order === 'asc' ? 1 : -1;

        if (a.isAssigned && !b.isAssigned) {
            return 1 * orderMultiplier;
        }

        if (!a.isAssigned && b.isAssigned) {
            return -1 * orderMultiplier;
        }

        const cardNameSortingResult = localeCompare(a.cardName, b.cardName) * orderMultiplier;

        if (!a.isAssigned && !b.isAssigned) {
            return cardNameSortingResult;
        }

        if (activeSorting.columnKey === 'member') {
            const aMemberString = a.cardholder?.displayName ?? a.cardholder?.login ?? '';
            const bMemberString = b.cardholder?.displayName ?? b.cardholder?.login ?? '';

            return localeCompare(aMemberString, bMemberString) * orderMultiplier;
        }

        if (activeSorting.columnKey === 'card') {
            return cardNameSortingResult;
        }

        if (activeSorting.columnKey === 'customCardName') {
            return localeCompare(a.customCardName ?? '', b.customCardName ?? '') * orderMultiplier;
        }

        return 0;
    };

    const assignedKeyword = translate('workspace.moreFeatures.companyCards.assignedCards').toLowerCase();
    const unassignedKeyword = translate('workspace.moreFeatures.companyCards.unassignedCards').toLowerCase();

    const isItemInSearch: IsItemInSearchCallback<WorkspaceCompanyCardTableItemData> = (item, searchString) => {
        const searchLower = searchString.toLowerCase();

        // Include assigned/unassigned cards if the user is typing "Unassigned" or "Assigned" (localized)
        const isAssignedCardMatch = assignedKeyword.startsWith(searchLower) && item.isAssigned;
        const isUnassignedCardMatch = unassignedKeyword.startsWith(searchLower) && !item.isAssigned;

        const searchTokens = [item.cardName, item.customCardName ?? '', item.cardholder?.displayName ?? '', item.cardholder?.login ?? ''];

        const matchingItems = tokenizedSearch([item], searchString, () => searchTokens);
        return matchingItems.length > 0 || isAssignedCardMatch || isUnassignedCardMatch;
    };

    const isItemInFilter: IsItemInFilterCallback<WorkspaceCompanyCardTableItemData> = (item, filterValues) => {
        if (!filterValues || filterValues.length === 0) {
            return true;
        }
        if (filterValues.includes('all')) {
            return true;
        }
        if (filterValues.includes('assigned') && item.isAssigned) {
            return true;
        }
        if (filterValues.includes('unassigned') && !item.isAssigned) {
            return true;
        }
        return false;
    };

    const filterConfig: FilterConfig = {
        status: {
            filterType: 'single-select',
            options: [
                {label: translate('workspace.moreFeatures.companyCards.allCards'), value: 'all'},
                {label: translate('workspace.moreFeatures.companyCards.assignedCards'), value: 'assigned'},
                {label: translate('workspace.moreFeatures.companyCards.unassignedCards'), value: 'unassigned'},
            ],
            default: 'all',
        },
    };

    const cardFeedIcon = (
        <CardFeedIcon
            key={feedName}
            iconProps={{
                height: variables.cardIconHeight,
                width: variables.cardIconWidth,
                additionalStyles: styles.cardIcon,
            }}
            selectedFeed={feedName}
        />
    );

    const renderItem = ({item, index}: ListRenderItemInfo<WorkspaceCompanyCardTableItemData>) => (
        <WorkspaceCompanyCardTableItem
            key={`${item.cardName}_${index}`}
            item={item}
            policyID={policy?.id ?? String(CONST.DEFAULT_NUMBER_ID)}
            feed={feedName}
            domainOrWorkspaceAccountID={domainOrWorkspaceAccountID}
            CardFeedIcon={cardFeedIcon}
            isPlaidCardFeed={isDirectCardFeed}
            onAssignCard={onAssignCard}
            isAssigningCardDisabled={isAssigningCardDisabled}
            shouldUseNarrowTableLayout={shouldUseNarrowTableLayout}
            columnCount={columns.length}
        />
    );

    const [activeSortingInWideLayout, setActiveSortingInWideLayout] = useState<ActiveSorting<CompanyCardsTableColumnKey> | undefined>(undefined);
    const isNarrowLayoutRef = useRef(shouldUseNarrowTableLayout);

    // When we switch from wide to narrow layout, we want to save the active sorting and set it to the member column.
    // When switching back to wide layout, we want to restore the previous sorting.
    useEffect(() => {
        if (shouldUseNarrowTableLayout) {
            if (isNarrowLayoutRef.current) {
                return;
            }

            isNarrowLayoutRef.current = true;
            const activeSorting = tableRef.current?.getActiveSorting();
            setActiveSortingInWideLayout(activeSorting);
            tableRef.current?.updateSorting({columnKey: 'member', order: 'asc'});
            return;
        }

        if (!activeSortingInWideLayout || !isNarrowLayoutRef.current) {
            return;
        }

        isNarrowLayoutRef.current = false;
        tableRef.current?.updateSorting(activeSortingInWideLayout);
    }, [activeSortingInWideLayout, shouldUseNarrowTableLayout]);

    return (
        <Table
            ref={tableRef}
            data={cardsData}
            columns={columns}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            compareItems={compareItems}
            isItemInSearch={isItemInSearch}
            isItemInFilter={isItemInFilter}
            filters={filterConfig}
            ListEmptyComponent={isLoadingCards ? <TableRowSkeleton fixedNumItems={5} /> : <WorkspaceCompanyCardsFeedAddedEmptyPage shouldShowGBDisclaimer={shouldShowGBDisclaimer} />}
        >
            {(showCards || isLoadingPage || isFeedPending) && (
                <View style={shouldUseNarrowTableLayout && styles.mb5}>
                    <WorkspaceCompanyCardsTableHeaderButtons
                        isLoading={isLoadingPage && !isFeedPending && !isNoFeed}
                        policyID={policy?.id}
                        feedName={feedName}
                        showTableControls={showTableControls}
                        CardFeedIcon={cardFeedIcon}
                    />
                </View>
            )}

            {(isLoadingPage || isFeedPending || isNoFeed) && (
                <ScrollView>
                    {/* Priority 1: Show skeleton when loading (but not with pending/empty) */}
                    {isLoadingPage && !isFeedPending && !isNoFeed && <TableRowSkeleton fixedNumItems={5} />}

                    {/* Priority 2: Show pending page when feed is pending and not loading */}
                    {!isLoadingPage && isFeedPending && (
                        <View style={styles.flex1}>
                            <WorkspaceCompanyCardsFeedPendingPage />
                        </View>
                    )}

                    {/* Priority 3: Show empty state (BYOC) only when confirmed no feed and not loading */}
                    {!isLoadingPage && !isFeedPending && isNoFeed && (
                        <View style={styles.flex1}>
                            <WorkspaceCompanyCardPageEmptyState
                                policy={policy}
                                shouldShowGBDisclaimer={shouldShowGBDisclaimer}
                            />
                        </View>
                    )}
                </ScrollView>
            )}

            {showCards && (
                <>
                    {!shouldUseNarrowTableLayout && !isLoadingFeed && <Table.Header />}
                    <Table.Body />
                </>
            )}
        </Table>
    );
}

export default WorkspaceCompanyCardsTable;
