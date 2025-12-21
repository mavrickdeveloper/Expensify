import type {ReactNode} from 'react';
import React, {useCallback, useMemo} from 'react';
import type {StyleProp, TextStyle, ViewStyle} from 'react-native';
import {Linking, View} from 'react-native';
import useThemeStyles from '@hooks/useThemeStyles';
import {openTravelDotLink} from '@libs/openTravelDotLink';
import {buildTripPostLoginPath, isTravelLink} from '@libs/TravelLinkUtils';
import EnvironmentBadge from './EnvironmentBadge';
import Text from './Text';
import TextLink from './TextLink';

type HeaderProps = {
    /** Title of the Header */
    title?: ReactNode;

    /** Subtitle of the header */
    subtitle?: ReactNode;

    /** Should we show the environment badge (dev/stg)?  */
    shouldShowEnvironmentBadge?: boolean;

    /** Additional text styles */
    textStyles?: StyleProp<TextStyle>;

    /** Additional header styles */
    style?: StyleProp<ViewStyle>;

    /** Additional header container styles */
    containerStyles?: StyleProp<ViewStyle>;

    /** The URL link associated with the attachment's subtitle, if available */
    subTitleLink?: string;

    /** Policy ID for authenticated travel links */
    policyID?: string;

    /** Line number for the title */
    numberOfTitleLines?: number;
};

function Header({title = '', subtitle = '', textStyles = [], style, containerStyles = [], shouldShowEnvironmentBadge = false, subTitleLink = '', policyID, numberOfTitleLines = 2}: HeaderProps) {
    const styles = useThemeStyles();
    const renderedSubtitle = useMemo(
        () => (
            <>
                {/* If there's no subtitle then display a fragment to avoid an empty space which moves the main title */}
                {typeof subtitle === 'string'
                    ? !!subtitle && (
                          <Text
                              style={[styles.mutedTextLabel, styles.pre]}
                              numberOfLines={1}
                          >
                              {subtitle}
                          </Text>
                      )
                    : subtitle}
            </>
        ),
        [subtitle, styles],
    );

    /**
     * Handles the subtitle link press event.
     * Routes travel links through Spotnana authentication,
     * falls back to Linking.openURL for non-travel links.
     */
    const handleSubTitleLinkPress = useCallback(() => {
        if (isTravelLink(subTitleLink) && policyID) {
            const postLoginPath = buildTripPostLoginPath(subTitleLink);
            openTravelDotLink(policyID, postLoginPath);
            return;
        }
        // Fallback to regular link opening for non-travel links or when policyID is missing
        Linking.openURL(subTitleLink);
    }, [subTitleLink, policyID]);

    const renderedSubTitleLink = useMemo(
        () => (
            <TextLink
                onPress={handleSubTitleLinkPress}
                numberOfLines={1}
                style={styles.label}
            >
                {subTitleLink}
            </TextLink>
        ),
        [styles.label, subTitleLink, handleSubTitleLinkPress],
    );

    return (
        <View style={[styles.flex1, styles.flexRow, containerStyles]}>
            <View style={[styles.mw100, style]}>
                {typeof title === 'string'
                    ? !!title && (
                          <Text
                              numberOfLines={numberOfTitleLines}
                              style={[styles.headerText, styles.textLarge, styles.lineHeightXLarge, textStyles]}
                          >
                              {title}
                          </Text>
                      )
                    : title}
                {renderedSubtitle}
                {!!subTitleLink && renderedSubTitleLink}
            </View>
            {shouldShowEnvironmentBadge && <EnvironmentBadge />}
        </View>
    );
}

export default Header;

export type {HeaderProps};
