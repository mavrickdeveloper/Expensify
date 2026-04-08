import React, {useEffect, useState} from 'react';
import {View} from 'react-native';
import PrevNextButtons from '@components/PrevNextButtons';
import Text from '@components/Text';
import useSearchSections from '@hooks/useSearchSections';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@navigation/Navigation';
import {saveLastSearchParams} from '@userActions/ReportNavigation';
import {search} from '@userActions/Search';
import CONST from '@src/CONST';

type MoneyRequestReportNavigationProps = {
    reportID?: string;
    shouldDisplayNarrowVersion: boolean;
};

function MoneyRequestReportNavigation({reportID, shouldDisplayNarrowVersion}: MoneyRequestReportNavigationProps) {
    const {allReports, isSearchLoading, lastSearchQuery} = useSearchSections();
    const [lastStableAllReports, setLastStableAllReports] = useState<Array<string | undefined>>([]);

    const type = lastSearchQuery?.queryJSON?.type;
    const currentIndex = allReports.indexOf(reportID);
    // Preserve the last valid report list while search recount is reconciling.
    const shouldUseFallbackReports =
        !!reportID &&
        !!lastSearchQuery?.allowPostSearchRecount &&
        lastStableAllReports.length > 1 &&
        lastStableAllReports.includes(reportID) &&
        (currentIndex === -1 || allReports.length <= 1);
    const effectiveAllReports = shouldUseFallbackReports ? lastStableAllReports : allReports;
    const effectiveCurrentIndex = effectiveAllReports.indexOf(reportID);
    const effectiveAllReportsLength = effectiveAllReports.length;
    const allReportsCount = lastSearchQuery?.previousLengthOfResults ?? effectiveAllReportsLength;

    const hideNextButton = !lastSearchQuery?.hasMoreResults && effectiveCurrentIndex === effectiveAllReportsLength - 1;
    const hidePrevButton = effectiveCurrentIndex === 0;
    const styles = useThemeStyles();
    const isExpenseReportSearch = type === CONST.SEARCH.DATA_TYPES.EXPENSE_REPORT;
    const shouldDisplayNavigationArrows = isExpenseReportSearch && effectiveAllReportsLength > 1 && effectiveCurrentIndex !== -1 && !!lastSearchQuery?.queryJSON;

    useEffect(() => {
        if (currentIndex === -1 || allReports.length <= 1) {
            return;
        }

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLastStableAllReports((previousReports) => {
            const isUnchanged = previousReports.length === allReports.length && previousReports.every((report, index) => report === allReports.at(index));

            if (isUnchanged) {
                return previousReports;
            }

            return [...allReports];
        });
    }, [allReports, currentIndex]);

    useEffect(() => {
        if (!lastSearchQuery?.queryJSON) {
            return;
        }

        if (lastSearchQuery.allowPostSearchRecount) {
            saveLastSearchParams({
                ...lastSearchQuery,
                allowPostSearchRecount: false,
                previousLengthOfResults: effectiveAllReportsLength,
            });
            return;
        }

        // Update count when reports are added or removed (e.g., created offline)
        if (effectiveAllReportsLength !== allReportsCount) {
            saveLastSearchParams({
                ...lastSearchQuery,
                previousLengthOfResults: effectiveAllReportsLength,
            });
            return;
        }

        if (effectiveCurrentIndex < allReportsCount - 1) {
            return;
        }

        saveLastSearchParams({
            ...lastSearchQuery,
            previousLengthOfResults: effectiveAllReportsLength,
        });
    }, [effectiveCurrentIndex, allReportsCount, effectiveAllReportsLength, lastSearchQuery?.queryJSON, lastSearchQuery]);

    const goToReportId = (reportId?: string) => {
        if (!reportId) {
            return;
        }
        Navigation.setParams({
            reportID: reportId,
        });
    };

    const goToNextReport = () => {
        if (effectiveCurrentIndex === -1 || effectiveAllReportsLength === 0 || !lastSearchQuery?.queryJSON) {
            return;
        }
        const threshold = Math.min(effectiveAllReportsLength * 0.75, effectiveAllReportsLength - 2);

        if (effectiveCurrentIndex + 1 >= threshold && lastSearchQuery?.hasMoreResults) {
            const newOffset = (lastSearchQuery.offset ?? 0) + CONST.SEARCH.RESULTS_PAGE_SIZE;
            search({
                queryJSON: lastSearchQuery.queryJSON,
                offset: newOffset,
                prevReportsLength: effectiveAllReportsLength,
                shouldCalculateTotals: false,
                searchKey: lastSearchQuery.searchKey,
                isLoading: isSearchLoading,
            });
        }

        const nextIndex = (effectiveCurrentIndex + 1) % effectiveAllReportsLength;
        goToReportId(effectiveAllReports.at(nextIndex));
    };

    const goToPrevReport = () => {
        if (effectiveCurrentIndex === -1 || effectiveAllReportsLength === 0) {
            return;
        }

        const prevIndex = (effectiveCurrentIndex - 1) % effectiveAllReportsLength;
        goToReportId(effectiveAllReports.at(prevIndex));
    };

    return (
        shouldDisplayNavigationArrows && (
            <View style={[styles.flexRow, styles.alignItemsCenter, styles.gap2]}>
                {!shouldDisplayNarrowVersion && <Text style={styles.mutedTextLabel}>{`${effectiveCurrentIndex + 1} of ${allReportsCount}`}</Text>}
                <PrevNextButtons
                    isPrevButtonDisabled={hidePrevButton}
                    isNextButtonDisabled={hideNextButton}
                    onNext={goToNextReport}
                    onPrevious={goToPrevReport}
                />
            </View>
        )
    );
}

export default MoneyRequestReportNavigation;
