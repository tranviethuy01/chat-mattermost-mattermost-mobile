// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {StyleSheet, TouchableWithoutFeedback, View} from 'react-native';
import Animated from 'react-native-reanimated';

import {updateDraftFile} from '@actions/local/draft';
import FileIcon from '@components/files/file_icon';
import ImageFile from '@components/files/image_file';
import ProgressBar from '@components/progress_bar';
import {useEditPost} from '@context/edit_post';
import {useServerUrl} from '@context/server';
import {useTheme} from '@context/theme';
import useDidUpdate from '@hooks/did_update';
import {useGalleryItem} from '@hooks/gallery';
import DraftEditPostUploadManager from '@managers/draft_upload_manager';
import {isImage} from '@utils/file';
import {changeOpacity} from '@utils/theme';

import UploadRemove from './upload_remove';
import UploadRetry from './upload_retry';

type Props = {
    channelId: string;
    galleryIdentifier: string;
    index: number;
    file: FileInfo;
    openGallery: (file: FileInfo) => void;
    rootId: string;
}

const style = StyleSheet.create({
    preview: {
        paddingTop: 5,
        marginLeft: 12,
    },
    previewContainer: {
        height: 56,
        width: 56,
        borderRadius: 4,
    },
    progress: {
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        height: 53,
        width: 53,
        justifyContent: 'flex-end',
        position: 'absolute',
        borderRadius: 4,
        paddingLeft: 3,
    },
    progressContainer: {
        paddingVertical: undefined,
        position: undefined,
        justifyContent: undefined,
    },
    filePreview: {
        width: 56,
        height: 56,
    },
});

export default function UploadItem({
    channelId, galleryIdentifier, index, file,
    rootId, openGallery,
}: Props) {
    const theme = useTheme();
    const serverUrl = useServerUrl();
    const removeCallback = useRef<(() => void) | undefined>(undefined);
    const [progress, setProgress] = useState(0);
    const {updateFileCallback, isEditMode} = useEditPost();

    const loading = DraftEditPostUploadManager.isUploading(file.clientId!);

    const handlePress = useCallback(() => {
        openGallery(file);
    }, [openGallery, file]);

    useEffect(() => {
        if (file.clientId) {
            removeCallback.current = DraftEditPostUploadManager.registerProgressHandler(file.clientId, setProgress);
        }
        return () => {
            removeCallback.current?.();
            removeCallback.current = undefined;
        };
    }, []);

    useDidUpdate(() => {
        if (loading && file.clientId) {
            removeCallback.current = DraftEditPostUploadManager.registerProgressHandler(file.clientId, setProgress);
        }
        return () => {
            removeCallback.current?.();
            removeCallback.current = undefined;
        };
    }, [file.failed, file.id]);

    const retryFileUpload = useCallback(() => {
        if (!file.failed) {
            return;
        }

        const newFile = {...file};
        newFile.failed = false;

        if (isEditMode && updateFileCallback) {
            // In edit mode, use the context callback to update the file
            updateFileCallback(newFile);
            DraftEditPostUploadManager.prepareUpload(
                serverUrl,
                newFile,
                channelId,
                rootId,
                newFile.bytesRead,
                true, // isEditPost = true
                updateFileCallback,
            );
        } else {
            // In draft mode, use the draft file system
            updateDraftFile(serverUrl, channelId, rootId, newFile);
            DraftEditPostUploadManager.prepareUpload(serverUrl, newFile, channelId, rootId, newFile.bytesRead);
        }

        DraftEditPostUploadManager.registerProgressHandler(newFile.clientId!, setProgress);
    }, [serverUrl, channelId, rootId, file, isEditMode, updateFileCallback]);

    const {styles, onGestureEvent, ref} = useGalleryItem(galleryIdentifier, index, handlePress);

    const filePreviewComponent = useMemo(() => {
        if (isImage(file)) {
            return (
                <ImageFile
                    file={file}
                    forwardRef={ref}
                    contentFit='cover'
                />
            );
        }
        return (
            <FileIcon
                backgroundColor={changeOpacity(theme.centerChannelColor, 0.08)}
                iconSize={60}
                file={file}
                testID={file.id}
            />
        );
    }, [file, ref, theme.centerChannelColor]);

    return (
        <View
            key={file.clientId}
            style={style.preview}
        >
            <View style={style.previewContainer}>
                <TouchableWithoutFeedback onPress={onGestureEvent}>
                    <Animated.View style={[styles, style.filePreview]}>
                        {filePreviewComponent}
                    </Animated.View>
                </TouchableWithoutFeedback>
                {file.failed &&
                <UploadRetry
                    onPress={retryFileUpload}
                />
                }
                {loading && !file.failed &&
                <View style={style.progress}>
                    <ProgressBar
                        progress={progress || 0}
                        color={theme.buttonBg}
                        containerStyle={style.progressContainer}
                    />
                </View>
                }
            </View>
            <UploadRemove
                clientId={file.clientId!}
                channelId={channelId}
                rootId={rootId}
                fileId={file.id!}
            />
        </View>
    );
}

