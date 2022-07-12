import { DeepPartial } from 'typeorm'

import * as coreService from '@nftcom/gql/service/core.service'
import { Profile } from '@nftcom/shared/db/entity'
const { repositories, generateCompositeImages } = jest.requireActual('@nftcom/gql/job/profile.job')

const mockProfilesData = [
  {
    id: 'test-id-1',
    photoURL: null,
  },
  {
    id: 'test-id-2',
    photoURL: null,
  },
  {
    id: 'test-id-3',
    photoURL: null,
  },
  {
    id: 'test-id-4',
    photoURL: null,
  },
  {
    id: 'test-id-5',
    photoURL: null,
  },
]
jest.mock('@nftcom/gql/job/profile.job', () => {
  return {
    repositories: {
      profile: {
        find: () => {
          return Promise.resolve()},
        updateOneById: (id: string, profile: DeepPartial<Profile>) =>{
          return Promise.resolve({ id, ...profile })},
      },
    },
  }
})

const GENERATE_COMPOSITE_IMAGE = 'GENERATE_COMPOSITE_IMAGE'

describe('profile job', () => {
  describe('generate composite images', () => {
    afterAll(() => {
      jest.clearAllMocks()
    })

    it('executes generate composite images job', async () => {
      const findSpy = jest.spyOn(repositories.profile, 'find')
        .mockImplementationOnce(
          () => Promise.resolve(mockProfilesData),
        )
      const compositeImageGeneratorSpy = jest.spyOn(coreService, 'generateCompositeImage')
        .mockImplementation(
          () => Promise.resolve('image-url'),
        )
      const updateSpy = jest.spyOn(repositories.profile, 'updateOneById')
        .mockImplementation(
          (id: string, profile: DeepPartial<Profile>) =>
            Promise.resolve({ id, ...profile }),
        )

      await generateCompositeImages({ id: 'test-job-id', data: GENERATE_COMPOSITE_IMAGE })
      
      expect(findSpy).toHaveBeenCalledTimes(1)
      expect(compositeImageGeneratorSpy).toHaveBeenCalledTimes(5)
      expect(updateSpy).toHaveBeenCalledTimes(5)
    })
  })
})