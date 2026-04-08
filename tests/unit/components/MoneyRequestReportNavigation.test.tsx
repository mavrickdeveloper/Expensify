import {render, screen} from '@testing-library/react-native';
import React from 'react';
import MoneyRequestReportNavigation from '@components/MoneyRequestReportView/MoneyRequestReportNavigation';
import CONST from '@src/CONST';

type MockSearchSectionsReturn = {
    allReports: Array<string | undefined>;
    isSearchLoading: boolean;
    lastSearchQuery: {
        queryJSON: {type: string};
        previousLengthOfResults: number;
        allowPostSearchRecount: boolean;
        hasMoreResults: boolean;
        offset?: number;
        searchKey?: string;
    };
};

const mockUseSearchSections = jest.fn<MockSearchSectionsReturn, []>();
const mockSaveLastSearchParams = jest.fn();
const mockSearch = jest.fn();

jest.mock('@hooks/useSearchSections', () => ({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __esModule: true,
    default: () => mockUseSearchSections(),
}));

jest.mock('@hooks/useThemeStyles', () => ({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __esModule: true,
    default: () => ({
        flexRow: {},
        alignItemsCenter: {},
        gap2: {},
        mutedTextLabel: {},
    }),
}));

jest.mock('@components/Text', () => {
    const ReactNative = require('react-native') as {
        Text: React.ComponentType<{children: React.ReactNode}>;
    };
    const Text = ReactNative.Text;

    return ({children}: {children: React.ReactNode}) => <Text>{children}</Text>;
});

jest.mock('@components/PrevNextButtons', () => {
    const ReactNative = require('react-native') as {
        Pressable: React.ComponentType<{
            accessibilityRole: string;
            children: React.ReactNode;
            disabled: boolean;
            onPress: () => void;
            testID: string;
        }>;
        Text: React.ComponentType<{children: React.ReactNode}>;
        View: React.ComponentType<{children: React.ReactNode}>;
    };
    const Pressable = ReactNative.Pressable;
    const Text = ReactNative.Text;
    const View = ReactNative.View;

    return ({isPrevButtonDisabled, isNextButtonDisabled, onPrevious, onNext}: {isPrevButtonDisabled: boolean; isNextButtonDisabled: boolean; onPrevious: () => void; onNext: () => void}) => (
        <View>
            <Pressable
                accessibilityRole="button"
                testID="prev-button"
                disabled={isPrevButtonDisabled}
                onPress={onPrevious}
            >
                <Text>prev</Text>
            </Pressable>
            <Pressable
                accessibilityRole="button"
                testID="next-button"
                disabled={isNextButtonDisabled}
                onPress={onNext}
            >
                <Text>next</Text>
            </Pressable>
        </View>
    );
});

jest.mock('@navigation/Navigation', () => ({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __esModule: true,
    default: {
        setParams: jest.fn(),
    },
}));

jest.mock('@userActions/ReportNavigation', () => ({
    saveLastSearchParams: (...args: unknown[]) => {
        mockSaveLastSearchParams(...args);
    },
}));

jest.mock('@userActions/Search', () => ({
    search: (...args: unknown[]) => {
        mockSearch(...args);
    },
}));

const buildSearchSections = (overrides?: Partial<MockSearchSectionsReturn>): MockSearchSectionsReturn => ({
    allReports: ['report1', 'report2'],
    isSearchLoading: false,
    lastSearchQuery: {
        queryJSON: {type: CONST.SEARCH.DATA_TYPES.EXPENSE_REPORT},
        previousLengthOfResults: 2,
        allowPostSearchRecount: false,
        hasMoreResults: false,
        searchKey: CONST.SEARCH.SEARCH_KEYS.REPORTS,
    },
    ...overrides,
});

describe('MoneyRequestReportNavigation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseSearchSections.mockReturnValue(buildSearchSections());
    });

    it('renders report navigation from the live search results', () => {
        render(
            <MoneyRequestReportNavigation
                reportID="report1"
                shouldDisplayNarrowVersion={false}
            />,
        );

        expect(screen.getByText('1 of 2')).toBeOnTheScreen();
        expect(mockSaveLastSearchParams).not.toHaveBeenCalled();
    });

    it('keeps using the last stable report list during a post-search recount', () => {
        const {rerender} = render(
            <MoneyRequestReportNavigation
                reportID="report1"
                shouldDisplayNarrowVersion={false}
            />,
        );

        mockUseSearchSections.mockReturnValue(
            buildSearchSections({
                allReports: ['report1'],
                lastSearchQuery: {
                    ...buildSearchSections().lastSearchQuery,
                    allowPostSearchRecount: true,
                },
            }),
        );

        rerender(
            <MoneyRequestReportNavigation
                reportID="report1"
                shouldDisplayNarrowVersion={false}
            />,
        );

        expect(screen.getByText('1 of 2')).toBeOnTheScreen();
        expect(mockSaveLastSearchParams).toHaveBeenCalledWith(
            expect.objectContaining({
                allowPostSearchRecount: false,
                previousLengthOfResults: 2,
            }),
        );
    });
});
