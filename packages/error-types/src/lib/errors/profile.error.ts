export enum ErrorType {
  ProfileNotFound = 'PROFILE_NOT_FOUND',
  ProfileNotMinted = 'PROFILE_NOT_MINTED',
  ProfileAlreadyFollowing = 'PROFILE_ALREADY_FOLLOWING',
  ProfileNotFollowing = 'PROFILE_NOT_FOLLOWING',
  ProfileNotOwned = 'PROFILE_NOT_OWNED',
  ProfileInvalid = 'PROFILE_INVALID',
  ProfileBannerFileSize = 'PROFILE_BANNER_FILE_SIZE',
  ProfileAvatarFileSize = 'PROFILE_AVATAR_FILE_SIZE',
  ProfileSortByType = 'PROFILE_SORT_BY_TYPE',
  KeyInvalid = 'KEY_INVALID',
  ProfileAssociatedContractNotFoundMsg = 'PROFILE_ASSOCIATED_CONTRACT_NOT_FOUND',
  ProfileViewTypeWrong = 'PROFILE_VIEW_TYPE_WRONG',
  ProfileDescriptionLength = 'PROFILE_DESCRIPTION_LENGTH',
  ProfileNoIds = 'PROFILE_NO_IDs',
}

export const buildProfileNotFoundMsg = (id: string): string => `Profile ${id} not found`

export const buildProfileUrlNotFoundMsg = (url: string, chainId: string): string =>
  `Profile URL  ${url} not found on chain ${chainId}`

export const buildAssociatedContractNotFoundMsg = (url: string, chainId: string): string =>
  `Profile URL  ${url} does not have associated contract on chain ${chainId}`

export const buildProfileViewTypeWrong = (): string => 'User did not toggle collection view on Profile'

export const buildProfileFollowingMsg = (id: string): string => `You are already following this profile ${id}`

export const buildProfileNotFollowingMsg = (id: string): string => `You are not following this profile ${id}`

export const buildProfileNotOwnedMsg = (id: string): string =>
  `You cannot update profile ${id} because you do not own it`

export const buildKeyNotValid = (id: string): string =>
  `Key ${id} does not exist! Please try again with a key from 1 - 10000`

export const buildProfileNotMintedMsg = (id: string): string => `Profile ${id} is not minted and doesn't have a tokenId`

export const buildProfileInvalidCharMsg = (id: string): string =>
  `Profile ${id} is not valid profile. Please use char [0-9a-z_] 1-100 characters`
export const buildProfileInvalidEthMsg = (id: string): string =>
  `Profile ${id} is not valid profile. Please do not use an ethereum address`
export const buildProfileInvalidBlacklistMsg = (id: string): string =>
  `Profile ${id} is a blacklisted profile. Please try another variation`
export const buildProfileInvalidReserveMsg = (id: string): string =>
  `Profile ${id} is a reserved profile. Please try another variation`

export const buildProfileBannerFileSize = (): string => 'Banner image file size should not exceed 5MB.'
export const buildProfileAvatarFileSize = (): string => 'Avatar image file size should not exceed 2MB.'

export const buildProfileSortByType = (): string => 'Profile sortBy type is not valid.'

export const buildProfileDescriptionLength = (): string => 'Length of profile description could not be longer than 300.'

export const buildProfileEmpty = (): string => 'ProfileIds cannot be empty. Please provide at least one id.'
