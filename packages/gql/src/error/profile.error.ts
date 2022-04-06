export enum ErrorType {
  ProfileNotFound = 'PROFILE_NOT_FOUND',
  ProfileNotMinted = 'PROFILE_NOT_MINTED',
  ProfileAlreadyFollowing = 'PROFILE_ALREADY_FOLLOWING',
  ProfileNotFollowing = 'PROFILE_NOT_FOLLOWING',
  ProfileNotOwned = 'PROFILE_NOT_OWNED',
  ProfileInvalid = 'PROFILE_INVALID',
  KeyInvalid = 'KEY_INVALID',
}

export const buildProfileNotFoundMsg = (id: string): string => `Profile ${id} not found`

export const buildProfileFollowingMsg = (id: string): string =>
  `You are already following this profile ${id}`

export const buildProfileNotFollowingMsg = (id: string): string =>
  `You are not following this profile ${id}`

export const buildProfileNotOwnedMsg = (id: string): string =>
  `You cannot update profile ${id} because you do not own it`

export const buildKeyNotValid = (id: string): string =>
  `Key ${id} does not exist! Please try again with a key from 1 - 10000`

export const buildProfileNotMintedMsg = (id: string): string => `Profile ${id} is not minted and doesn't have a tokenId`

export const buildProfileInvalidCharMsg = (id: string): string => `Profile ${id} is not valid profile. Please use char [0-9a-z_] 1-100 characters`
export const buildProfileInvalidEthMsg = (id: string): string => `Profile ${id} is not valid profile. Please do not use an ethereum address`
export const buildProfileInvalidBlacklistMsg = (id: string): string => `Profile ${id} is a blacklisted profile. Please try another variation`
