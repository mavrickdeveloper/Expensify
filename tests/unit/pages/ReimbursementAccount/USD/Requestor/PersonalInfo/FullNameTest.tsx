import {render} from '@testing-library/react-native';
import React from 'react';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import FullNameStep from '@components/SubStepForms/FullNameStep';
import useOnyx from '@hooks/useOnyx';
import FullName from '@pages/ReimbursementAccount/USD/Requestor/PersonalInfo/subSteps/FullName';
import ONYXKEYS from '@src/ONYXKEYS';

const mockHandleSubmit = jest.fn();

jest.mock('@components/SubStepForms/FullNameStep', () => jest.fn(() => null));
jest.mock('@components/FullscreenLoadingIndicator', () => jest.fn(() => null));
jest.mock('@hooks/useLocalize', () => ({
    __esModule: true,
    default: () => ({
        translate: (key: string) => key,
    }),
}));
jest.mock('@hooks/useOnyx', () => jest.fn());
jest.mock('@hooks/useReimbursementAccountStepFormSubmit', () => ({
    __esModule: true,
    default: () => mockHandleSubmit,
}));

const mockFullNameStep = jest.mocked(FullNameStep);
const mockFullScreenLoadingIndicator = jest.mocked(FullScreenLoadingIndicator);
const mockUseOnyx = jest.mocked(useOnyx);

describe('FullName', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('waits for reimbursement account data before mounting the form', () => {
        mockUseOnyx.mockImplementation((key: string) => {
            if (key === ONYXKEYS.REIMBURSEMENT_ACCOUNT) {
                return [undefined, {status: 'loading'}];
            }
            return [undefined, {status: 'loaded'}];
        });

        render(
            <FullName
                isEditing={false}
                onNext={jest.fn()}
                onMove={jest.fn()}
            />,
        );

        expect(mockFullNameStep).not.toHaveBeenCalled();
        expect(mockFullScreenLoadingIndicator).toHaveBeenCalled();
    });

    it('mounts the form with saved names after reimbursement account loading completes', () => {
        let isLoading = true;

        mockUseOnyx.mockImplementation((key: string) => {
            if (key === ONYXKEYS.REIMBURSEMENT_ACCOUNT) {
                return isLoading
                    ? [undefined, {status: 'loading'}]
                    : [
                          {
                              achData: {
                                  firstName: 'Ada',
                                  lastName: 'Lovelace',
                              },
                          },
                          {status: 'loaded'},
                      ];
            }
            return [undefined, {status: 'loaded'}];
        });

        const props = {
            isEditing: false,
            onNext: jest.fn(),
            onMove: jest.fn(),
        };
        const {rerender} = render(<FullName {...props} />);

        expect(mockFullNameStep).not.toHaveBeenCalled();
        expect(mockFullScreenLoadingIndicator).toHaveBeenCalled();

        isLoading = false;
        rerender(<FullName {...props} />);

        expect(mockFullNameStep.mock.lastCall?.at(0)).toEqual(expect.objectContaining({defaultValues: {firstName: 'Ada', lastName: 'Lovelace'}}));
    });

    it('passes saved requestor names as form defaults once reimbursement account data is loaded', () => {
        mockUseOnyx.mockImplementation((key: string) => {
            if (key === ONYXKEYS.REIMBURSEMENT_ACCOUNT) {
                return [
                    {
                        achData: {
                            firstName: 'Ada',
                            lastName: 'Lovelace',
                        },
                    },
                    {status: 'loaded'},
                ];
            }
            return [undefined, {status: 'loaded'}];
        });

        render(
            <FullName
                isEditing={false}
                onNext={jest.fn()}
                onMove={jest.fn()}
            />,
        );

        const props = mockFullNameStep.mock.lastCall?.at(0);
        expect(mockFullScreenLoadingIndicator).not.toHaveBeenCalled();
        expect(props).toEqual(expect.objectContaining({defaultValues: {firstName: 'Ada', lastName: 'Lovelace'}}));
    });

    it('falls back to draft values if loaded bank account data is sparse', () => {
        mockUseOnyx.mockImplementation((key: string) => {
            if (key === ONYXKEYS.REIMBURSEMENT_ACCOUNT) {
                return [{achData: {}}, {status: 'loaded'}];
            }
            if (key === ONYXKEYS.FORMS.REIMBURSEMENT_ACCOUNT_FORM_DRAFT) {
                return [{firstName: 'Grace', lastName: 'Hopper'}, {status: 'loaded'}];
            }
            return [undefined, {status: 'loaded'}];
        });

        render(
            <FullName
                isEditing={false}
                onNext={jest.fn()}
                onMove={jest.fn()}
            />,
        );

        const props = mockFullNameStep.mock.lastCall?.at(0);
        expect(props).toEqual(expect.objectContaining({defaultValues: {firstName: 'Grace', lastName: 'Hopper'}}));
    });
});
