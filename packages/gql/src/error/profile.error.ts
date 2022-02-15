export enum ErrorType {
  ProfileNotFound = 'PROFILE_NOT_FOUND',
  ProfileNotMinted = 'PROFILE_NOT_MINTED',
  ProfileAlreadyFollowing = 'PROFILE_ALREADY_FOLLOWING',
  ProfileNotFollowing = 'PROFILE_NOT_FOLLOWING',
  ProfileNotOwned = 'PROFILE_NOT_OWNED',
}

export const buildProfileNotFoundMsg = (id: string): string => `Profile ${id} not found`

export const buildProfileFollowingMsg = (id: string): string =>
  `You are already following this profile ${id}`

export const buildProfileNotFollowingMsg = (id: string): string =>
  `You are not following this profile ${id}`

export const buildProfileNotOwnedMsg = (id: string): string =>
  `You cannot update profile ${id} because you do not own it`

export const buildProfileNotMintedMsg = (id: string): string => `Profile ${id} is not minted and doesn't have a tokenId`
