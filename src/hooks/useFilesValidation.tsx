import {Str} from 'expensify-common';
import React, {useRef, useState} from 'react';
import {InteractionManager} from 'react-native';
import type {ValueOf} from 'type-fest';
import ConfirmModal from '@components/ConfirmModal';
import {useFullScreenLoaderActions} from '@components/FullScreenLoaderContext';
import PDFThumbnail from '@components/PDFThumbnail';
import Text from '@components/Text';
import TextLink from '@components/TextLink';
import {getFileValidationErrorText, hasHeicOrHeifExtension, resizeImageIfNeeded, splitExtensionFromFileName} from '@libs/fileDownload/FileUtils';
import type {FileValidationError} from '@libs/fileDownload/FileUtils';
import convertHeicImage from '@libs/fileDownload/heicConverter';
import Log from '@libs/Log';
import validateAttachmentFile from '@libs/validateAttachmentFile';
import CONST from '@src/CONST';
import type {FileObject} from '@src/types/utils/Attachment';
import useLocalize from './useLocalize';
import useThemeStyles from './useThemeStyles';

const DEFAULT_IS_VALIDATING_RECEIPTS = true;

type ValidationOptions = {
    isValidatingReceipts?: boolean;
};

type ValidationState = {
    isValidatingReceipts: boolean;
    isValidatingMultipleFiles: boolean;
};

const sortFilesByOriginalOrder = (files: FileObject[], orderMap: Map<string, number>) => {
    return files.sort((a, b) => (orderMap.get(a.uri ?? '') ?? 0) - (orderMap.get(b.uri ?? '') ?? 0));
};

const isImageFile = (file: FileObject) => hasHeicOrHeifExtension(file) ?? Str.isImage(file.name ?? '');
const getFileValidationKey = (file: FileObject) => file.uri ?? `${file.name ?? ''}-${file.size ?? 0}-${file.type ?? ''}`;

function useFilesValidation(onFilesValidated: (files: FileObject[], dataTransferItems: DataTransferItem[]) => void) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();

    const [isValidatingFiles, setIsValidatingFiles] = useState(false);
    const [isValidatingReceipts, setIsValidatingReceipts] = useState<boolean>();
    const [isValidatingMultipleFiles, setIsValidatingMultipleFiles] = useState(false);

    const [isErrorModalVisible, setIsErrorModalVisible] = useState(false);
    const [fileError, setFileError] = useState<FileValidationError | null>(null);
    const [pdfFilesToRender, setPdfFilesToRender] = useState<FileObject[]>([]);
    const [validFilesToUpload, setValidFilesToUpload] = useState([] as FileObject[]);
    const [errorQueue, setErrorQueue] = useState<FileValidationError[]>([]);
    const [currentErrorIndex, setCurrentErrorIndex] = useState(0);
    const {setIsLoaderVisible} = useFullScreenLoaderActions();

    const validatedPDFs = useRef<FileObject[]>([]);
    const validFiles = useRef<FileObject[]>([]);
    const filesToValidate = useRef<FileObject[]>([]);
    const dataTransferItemList = useRef<DataTransferItem[]>([]);
    const collectedErrors = useRef<FileValidationError[]>([]);
    const originalFileOrder = useRef<Map<string, number>>(new Map());
    const activeValidationSessionID = useRef(0);
    const expectedPDFCount = useRef(0);
    const processedPDFKeys = useRef<Set<string>>(new Set());

    const updateFileOrderMapping = (oldFile: FileObject | undefined, newFile: FileObject) => {
        const originalIndex = originalFileOrder.current.get(oldFile?.uri ?? '');
        if (originalIndex !== undefined) {
            originalFileOrder.current.set(newFile.uri ?? '', originalIndex);
        }
    };

    const deduplicateErrors = (errors: FileValidationError[]) => {
        const uniqueErrors = new Set<string>();
        return errors.filter((error) => {
            const key = `${error.error}-${error.fileType ?? ''}`;
            if (uniqueErrors.has(key)) {
                return false;
            }
            uniqueErrors.add(key);
            return true;
        });
    };

    const resetValidationRefs = () => {
        validatedPDFs.current = [];
        validFiles.current = [];
        filesToValidate.current = [];
        dataTransferItemList.current = [];
        collectedErrors.current = [];
        originalFileOrder.current.clear();
        expectedPDFCount.current = 0;
        processedPDFKeys.current.clear();
    };

    const prepareValidationSession = () => {
        activeValidationSessionID.current += 1;
        setIsErrorModalVisible(false);
        setPdfFilesToRender([]);
        setValidFilesToUpload([]);
        setFileError(null);
        setErrorQueue([]);
        setCurrentErrorIndex(0);
        resetValidationRefs();
        return activeValidationSessionID.current;
    };

    const reset = () => {
        prepareValidationSession();
        setIsValidatingFiles(false);
        setIsValidatingReceipts(undefined);
        setIsLoaderVisible(false);
    };

    const hideModalAndReset = () => {
        setIsErrorModalVisible(false);
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        InteractionManager.runAfterInteractions(() => {
            reset();
        });
    };

    const setErrorAndOpenModal = (error: ValueOf<typeof CONST.FILE_VALIDATION_ERRORS>) => {
        setFileError({error, isValidatingMultipleFiles});
        setIsErrorModalVisible(true);
    };

    const checkIfAllValidatedAndProceed = (validationSessionID: number) => {
        if (validationSessionID !== activeValidationSessionID.current) {
            return;
        }

        if (!validatedPDFs.current || !validFiles.current || expectedPDFCount.current === 0) {
            return;
        }

        if (validatedPDFs.current.length !== expectedPDFCount.current) {
            return;
        }

        if (validFiles.current.length > 0) {
            setValidFilesToUpload(validFiles.current);
        }

        if (collectedErrors.current.length > 0) {
            const uniqueErrors = deduplicateErrors(collectedErrors.current);
            setErrorQueue(uniqueErrors);
            setCurrentErrorIndex(0);
            const firstError = uniqueErrors.at(0);
            if (firstError) {
                setFileError(firstError);
                setIsErrorModalVisible(true);
            }
        } else if (validFiles.current.length > 0) {
            const sortedFiles = sortFilesByOriginalOrder(validFiles.current, originalFileOrder.current);
            onFilesValidated(sortedFiles, dataTransferItemList.current);
            reset();
        }
    };

    const handlePDFValidationResult = (file: FileObject, validationSessionID: number, result: 'loadError' | 'loadSuccess' | 'password') => {
        if (validationSessionID !== activeValidationSessionID.current) {
            return;
        }

        const fileValidationKey = getFileValidationKey(file);
        if (processedPDFKeys.current.has(fileValidationKey)) {
            return;
        }

        processedPDFKeys.current.add(fileValidationKey);
        validatedPDFs.current.push(file);

        if (result === 'loadSuccess') {
            validFiles.current.push(file);
        } else if (result === 'password') {
            if (isValidatingReceipts === true) {
                collectedErrors.current.push({error: CONST.FILE_VALIDATION_ERRORS.PROTECTED_FILE});
            } else {
                validFiles.current.push(file);
            }
        } else {
            collectedErrors.current.push({error: CONST.FILE_VALIDATION_ERRORS.FILE_CORRUPTED});
        }
        checkIfAllValidatedAndProceed(validationSessionID);
    };

    async function validateAndResizeFiles(files: FileObject[], items: DataTransferItem[], validationState: ValidationState, validationSessionID: number) {
        if (validationSessionID !== activeValidationSessionID.current) {
            return;
        }

        if (files.length === 0) {
            return;
        }

        // Reset collected errors for new validation
        collectedErrors.current = [];

        for (const [index, file] of files.entries()) {
            originalFileOrder.current.set(file.uri ?? '', index);
        }

        const pdfsToLoad: FileObject[] = [];
        const validNonPdfFiles: FileObject[] = [];

        const filesToResize: FileObject[] = [];
        const filesToConvert: FileObject[] = [];
        await Promise.all(
            files.map(async (file, index) => {
                const result = await validateAttachmentFile(file, items.at(index), validationState.isValidatingReceipts);

                if (result.isValid) {
                    if (Str.isPDF(result.file.name ?? '')) {
                        pdfsToLoad.push(result.file);
                    } else {
                        validNonPdfFiles.push(result.file);
                    }
                    return;
                }

                if (result.error === CONST.FILE_VALIDATION_ERRORS.FILE_TOO_LARGE && isImageFile(file) && validationState.isValidatingReceipts) {
                    filesToResize.push(file);
                    return;
                }

                if (result.error === CONST.FILE_VALIDATION_ERRORS.HEIC_OR_HEIF_IMAGE) {
                    filesToConvert.push(file);
                    return;
                }

                const errorData = {
                    error: result.error,
                    isValidatingMultipleFiles: validationState.isValidatingMultipleFiles,
                    fileType: result.error === CONST.FILE_VALIDATION_ERRORS.WRONG_FILE_TYPE ? splitExtensionFromFileName(file.name ?? '').fileExtension : undefined,
                } satisfies FileValidationError;
                collectedErrors.current.push(errorData);
            }),
        );

        if (validationSessionID !== activeValidationSessionID.current) {
            return;
        }

        if (filesToConvert.length > 0) {
            setIsLoaderVisible(true);

            const convertedFilesToResize: FileObject[] = [];
            const convertedFiles: FileObject[] = [];
            await Promise.all(
                filesToConvert.map(
                    (file) =>
                        new Promise<void>((resolve) => {
                            convertHeicImage(file, {
                                onSuccess: (convertedFile) => {
                                    if (validationState.isValidatingReceipts && convertedFile.size && convertedFile.size > CONST.API_ATTACHMENT_VALIDATIONS.RECEIPT_MAX_SIZE) {
                                        convertedFilesToResize.push(convertedFile);
                                        resolve();
                                        return;
                                    }

                                    if (!validationState.isValidatingReceipts && convertedFile.size && convertedFile.size > CONST.API_ATTACHMENT_VALIDATIONS.MAX_SIZE) {
                                        collectedErrors.current.push({
                                            error: CONST.FILE_VALIDATION_ERRORS.FILE_TOO_LARGE,
                                            isValidatingMultipleFiles: validationState.isValidatingMultipleFiles,
                                        });
                                        resolve();
                                        return;
                                    }

                                    convertedFiles.push(convertedFile);
                                    resolve();
                                },
                                onError: () => {
                                    Log.warn('HEIC conversion failed, falling back to original file', {fileName: file.name});
                                    convertedFiles.push(file);
                                    resolve();
                                },
                            });
                        }),
                ),
            );

            filesToResize.push(...convertedFilesToResize);
            validNonPdfFiles.push(...convertedFiles);

            for (const [index, convertedFile] of convertedFiles.entries()) {
                updateFileOrderMapping(filesToConvert.at(index), convertedFile);
            }
        }

        if (validationSessionID !== activeValidationSessionID.current) {
            return;
        }

        if (filesToResize.length > 0) {
            setIsLoaderVisible(true);

            const toResizeResults = await Promise.allSettled(filesToResize.map((file) => resizeImageIfNeeded(file)));

            for (const [index, result] of toResizeResults.entries()) {
                if (result.status === 'fulfilled') {
                    const value = result.value;
                    validNonPdfFiles.push(value);
                    updateFileOrderMapping(filesToResize.at(index), value);
                } else {
                    const errorMessage = result.reason instanceof Error ? result.reason.message : undefined;
                    if (errorMessage === CONST.FILE_VALIDATION_ERRORS.IMAGE_DIMENSIONS_TOO_LARGE) {
                        collectedErrors.current.push({error: CONST.FILE_VALIDATION_ERRORS.IMAGE_DIMENSIONS_TOO_LARGE, isValidatingMultipleFiles});
                    } else {
                        collectedErrors.current.push({error: CONST.FILE_VALIDATION_ERRORS.FILE_CORRUPTED, isValidatingMultipleFiles});
                    }
                }
            }
        }

        if (validationSessionID !== activeValidationSessionID.current) {
            return;
        }

        setIsLoaderVisible(false);

        if (pdfsToLoad.length) {
            expectedPDFCount.current = pdfsToLoad.length;
            validFiles.current = validNonPdfFiles;
            setPdfFilesToRender(pdfsToLoad);
            return;
        }

        if (validNonPdfFiles.length > 0) {
            setValidFilesToUpload(validNonPdfFiles);
        }

        if (collectedErrors.current.length > 0) {
            const uniqueErrors = Array.from(new Set(collectedErrors.current.map((error) => JSON.stringify(error)))).map((errorStr) => JSON.parse(errorStr) as FileValidationError);
            setErrorQueue(uniqueErrors);
            setCurrentErrorIndex(0);
            const firstError = uniqueErrors.at(0);
            if (firstError) {
                setFileError(firstError);
                setIsErrorModalVisible(true);
            }
        } else if (validNonPdfFiles.length > 0) {
            const sortedFiles = sortFilesByOriginalOrder(validNonPdfFiles, originalFileOrder.current);
            onFilesValidated(sortedFiles, dataTransferItemList.current);
            reset();
        }
    }

    const validateFiles = (files: FileObject[], items?: DataTransferItem[], validationOptions?: ValidationOptions) => {
        if (isValidatingFiles) {
            Log.warn('Files are already being validated. Please wait for the current validation to complete before calling `validateFiles` again.');
            return;
        }

        setIsValidatingFiles(true);

        const validationState: ValidationState = {
            isValidatingReceipts: validationOptions?.isValidatingReceipts ?? DEFAULT_IS_VALIDATING_RECEIPTS,
            isValidatingMultipleFiles: files.length > 1,
        };
        setIsValidatingReceipts(validationState.isValidatingReceipts);
        setIsValidatingMultipleFiles(validationState.isValidatingMultipleFiles);

        if (files.length > CONST.API_ATTACHMENT_VALIDATIONS.MAX_FILE_LIMIT) {
            prepareValidationSession();
            filesToValidate.current = files.slice(0, CONST.API_ATTACHMENT_VALIDATIONS.MAX_FILE_LIMIT);
            if (items) {
                dataTransferItemList.current = items.slice(0, CONST.API_ATTACHMENT_VALIDATIONS.MAX_FILE_LIMIT);
            }
            setErrorAndOpenModal(CONST.FILE_VALIDATION_ERRORS.MAX_FILE_LIMIT_EXCEEDED);
        } else {
            const validationSessionID = prepareValidationSession();
            validateAndResizeFiles(files, items ?? [], validationState, validationSessionID);
        }
    };

    const onConfirmError = () => {
        if (fileError?.error === CONST.FILE_VALIDATION_ERRORS.MAX_FILE_LIMIT_EXCEEDED) {
            setIsErrorModalVisible(false);
            const validationState: ValidationState = {
                isValidatingReceipts: isValidatingReceipts ?? false,
                isValidatingMultipleFiles,
            };
            const pendingFilesToValidate = filesToValidate.current;
            const pendingDataTransferItems = dataTransferItemList.current;
            const validationSessionID = prepareValidationSession();
            validateAndResizeFiles(pendingFilesToValidate, pendingDataTransferItems, validationState, validationSessionID);
            return;
        }

        if (currentErrorIndex < errorQueue.length - 1) {
            const nextIndex = currentErrorIndex + 1;
            const nextError = errorQueue.at(nextIndex);
            if (nextError) {
                if (isValidatingMultipleFiles && currentErrorIndex === errorQueue.length - 2 && validFilesToUpload.length === 0) {
                    setIsValidatingMultipleFiles(false);
                }
                setCurrentErrorIndex(nextIndex);
                setFileError(nextError);
                return;
            }
        }

        const sortedFiles = sortFilesByOriginalOrder(validFilesToUpload, originalFileOrder.current);
        // If we're validating attachments we need to use InteractionManager to ensure
        // the error modal is dismissed before opening the attachment modal
        if (isValidatingReceipts === false && fileError) {
            setIsErrorModalVisible(false);
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            InteractionManager.runAfterInteractions(() => {
                if (sortedFiles.length !== 0) {
                    onFilesValidated(sortedFiles, dataTransferItemList.current);
                }
                reset();
            });
        } else {
            if (sortedFiles.length !== 0) {
                onFilesValidated(sortedFiles, dataTransferItemList.current);
            }
            hideModalAndReset();
        }
    };

    const pdfValidationSessionID = activeValidationSessionID.current;
    const PDFValidationComponent = pdfFilesToRender.length
        ? pdfFilesToRender.map((file) => (
              <PDFThumbnail
                  key={file.uri}
                  style={styles.invisiblePDF}
                  previewSourceURL={file.uri ?? ''}
                  onLoadSuccess={() => {
                      handlePDFValidationResult(file, pdfValidationSessionID, 'loadSuccess');
                  }}
                  onPassword={() => {
                      handlePDFValidationResult(file, pdfValidationSessionID, 'password');
                  }}
                  onLoadError={() => {
                      handlePDFValidationResult(file, pdfValidationSessionID, 'loadError');
                  }}
              />
          ))
        : undefined;

    const fileValidationErrorText = getFileValidationErrorText(translate, fileError, {isValidatingReceipt: isValidatingReceipts});

    const getModalPrompt = () => {
        if (!fileError) {
            return '';
        }
        const prompt = fileValidationErrorText.reason;
        if (fileError.error === CONST.FILE_VALIDATION_ERRORS.WRONG_FILE_TYPE) {
            return (
                <Text>
                    {prompt}
                    <TextLink href={CONST.BULK_UPLOAD_HELP_URL}> {translate('attachmentPicker.learnMoreAboutSupportedFiles')}</TextLink>
                </Text>
            );
        }
        return prompt;
    };

    const ErrorModal = (
        <ConfirmModal
            title={fileValidationErrorText.title}
            onConfirm={onConfirmError}
            onCancel={hideModalAndReset}
            isVisible={isErrorModalVisible}
            prompt={getModalPrompt()}
            confirmText={translate(isValidatingMultipleFiles ? 'common.continue' : 'common.close')}
            cancelText={translate('common.cancel')}
            shouldShowCancelButton={isValidatingMultipleFiles}
        />
    );

    return {
        isValidatingFiles,
        PDFValidationComponent,
        validateFiles,
        ErrorModal,
    };
}

export default useFilesValidation;
