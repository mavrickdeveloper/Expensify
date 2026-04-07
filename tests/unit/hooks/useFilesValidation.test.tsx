import {act, render, waitFor} from '@testing-library/react-native';
import React, {useImperativeHandle} from 'react';
import {View} from 'react-native';
import useFilesValidation from '@hooks/useFilesValidation';
import validateAttachmentFile from '@libs/validateAttachmentFile';
import type {FileObject} from '@src/types/utils/Attachment';

type HookHandle = {
    validateFiles: (files: FileObject[]) => void;
};

type PDFThumbnailCallbacks = {
    onLoadError: () => void;
    onLoadSuccess: () => void;
    onPassword: () => void;
};

const mockPDFThumbnailCallbacks = new Map<string, PDFThumbnailCallbacks>();
const mockSetIsLoaderVisible = jest.fn();

jest.mock('@components/PDFThumbnail', () => {
    return function MockPDFThumbnail({
        previewSourceURL,
        onLoadError,
        onLoadSuccess,
        onPassword,
    }: {
        previewSourceURL: string;
        onLoadError?: () => void;
        onLoadSuccess?: () => void;
        onPassword?: () => void;
    }) {
        mockPDFThumbnailCallbacks.set(previewSourceURL, {
            onLoadError: onLoadError ?? (() => {}),
            onLoadSuccess: onLoadSuccess ?? (() => {}),
            onPassword: onPassword ?? (() => {}),
        });
        return null;
    };
});

jest.mock('@components/ConfirmModal', () => () => null);

jest.mock('@components/FullScreenLoaderContext', () => ({
    useFullScreenLoaderActions: () => ({
        setIsLoaderVisible: mockSetIsLoaderVisible,
    }),
}));

jest.mock('@hooks/useLocalize', () => () => ({
    translate: (key: string) => key,
}));

jest.mock('@hooks/useThemeStyles', () => () => ({
    invisiblePDF: {},
}));

jest.mock('@libs/validateAttachmentFile');

const TestUseFilesValidation = React.forwardRef<
    HookHandle,
    {
        onFilesValidated: (files: FileObject[], dataTransferItems: DataTransferItem[]) => void;
    }
>(({onFilesValidated}, ref) => {
    const {validateFiles, PDFValidationComponent} = useFilesValidation(onFilesValidated);

    useImperativeHandle(ref, () => ({
        validateFiles,
    }));

    return <View>{PDFValidationComponent}</View>;
});

describe('useFilesValidation', () => {
    const mockedValidateAttachmentFile = jest.mocked(validateAttachmentFile);

    beforeEach(() => {
        mockPDFThumbnailCallbacks.clear();
        mockSetIsLoaderVisible.mockClear();
        mockedValidateAttachmentFile.mockImplementation(async (file) => ({isValid: true, file}) as never);
    });

    it('ignores stale PDF callbacks from a completed validation session', async () => {
        const ref = React.createRef<HookHandle>();
        const onFilesValidated = jest.fn();
        const firstFile = {uri: 'file:///issue81225-a.pdf', name: 'issue81225-a.pdf', type: 'application/pdf', size: 246000} as FileObject;
        const secondFile = {uri: 'file:///issue81225-b.pdf', name: 'issue81225-b.pdf', type: 'application/pdf', size: 246000} as FileObject;

        render(
            <TestUseFilesValidation
                ref={ref}
                onFilesValidated={onFilesValidated}
            />,
        );

        act(() => {
            ref.current?.validateFiles([firstFile]);
        });

        await waitFor(() => expect(mockPDFThumbnailCallbacks.get(firstFile.uri ?? '')).toBeDefined());

        const firstValidationCallbacks = mockPDFThumbnailCallbacks.get(firstFile.uri ?? '');
        act(() => {
            firstValidationCallbacks?.onLoadSuccess();
        });

        await waitFor(() => expect(onFilesValidated).toHaveBeenCalledTimes(1));
        expect(onFilesValidated).toHaveBeenNthCalledWith(1, [firstFile], []);

        act(() => {
            firstValidationCallbacks?.onLoadSuccess();
        });

        act(() => {
            ref.current?.validateFiles([secondFile]);
        });

        await waitFor(() => expect(mockPDFThumbnailCallbacks.get(secondFile.uri ?? '')).toBeDefined());

        act(() => {
            mockPDFThumbnailCallbacks.get(secondFile.uri ?? '')?.onLoadSuccess();
        });

        await waitFor(() => expect(onFilesValidated).toHaveBeenCalledTimes(2));
        expect(onFilesValidated).toHaveBeenNthCalledWith(2, [secondFile], []);
    });
});
