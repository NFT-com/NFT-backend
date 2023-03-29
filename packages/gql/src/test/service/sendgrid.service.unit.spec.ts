import * as sendgridService from '@nftcom/gql/service/sendgrid.service'
import { entity } from '@nftcom/shared/db'
import sendgrid from '@sendgrid/mail'

import { testMockUser, testMockWallet } from '../util/constants'

jest.mock('@sendgrid/mail', () => {
  return {
    setApiKey: jest.fn(),
    send: jest.fn(),
  }
})

let mailerSuccessResponse, mailerFailureResponse
describe('sendgrid service', () => {
  describe('sendgrid send email', () => {
    beforeAll(async () => {
      mailerSuccessResponse = true
      mailerFailureResponse = undefined
    })

    afterAll(async () => {
      jest.clearAllMocks()
    })

    it('sends confirmation email', async () => {
      ;(sendgrid.send as jest.MockedFunction<typeof sendgrid.send>).mockResolvedValueOnce(mailerSuccessResponse)
      const testUser: Partial<entity.User> = {
        email: testMockUser.email,
        confirmEmailToken: 'test',
      }

      const testSendResponse = await sendgridService.sendConfirmEmail(testUser as entity.User)
      expect(testSendResponse).toBe(mailerSuccessResponse)
      expect(sendgrid.send).toBeCalled()
    })

    it('fails to send confirmation email', async () => {
      ;(sendgrid.send as jest.MockedFunction<typeof sendgrid.send>).mockResolvedValueOnce(mailerFailureResponse)
      const testUser: Partial<entity.User> = {
        email: '',
        confirmEmailToken: 'test',
      }

      const testSendResponse = await sendgridService.sendConfirmEmail(testUser as entity.User)
      expect(testSendResponse).toBe(mailerFailureResponse)
      expect(sendgrid.send).toBeCalled()
    })

    it('sends referred by email', async () => {
      ;(sendgrid.send as jest.MockedFunction<typeof sendgrid.send>).mockResolvedValueOnce(mailerFailureResponse)
      const testUser: Partial<entity.User> = {
        email: testMockUser.email,
      }

      const totalReferrals = 10

      const testSendResponse = await sendgridService.sendReferredBy(testUser as entity.User, totalReferrals)
      expect(testSendResponse).toBe(mailerSuccessResponse)
      expect(sendgrid.send).toBeCalled()
    })

    it('sends bid confirmation email', async () => {
      ;(sendgrid.send as jest.MockedFunction<typeof sendgrid.send>).mockResolvedValueOnce(mailerFailureResponse)
      const bid: Partial<entity.Bid> = {
        price: '10',
      }
      const testUser: Partial<entity.User> = {
        email: testMockUser.email,
        preferences: {
          outbidNotifications: false,
          bidActivityNotifications: true,
          priceChangeNotifications: false,
          purchaseSuccessNotifications: false,
          promotionalNotifications: false,
        },
      }

      const profileUrl = 'test-profile'

      const testSendResponse = await sendgridService.sendBidConfirmEmail(
        bid as entity.Bid,
        testUser as entity.User,
        profileUrl,
      )
      expect(testSendResponse).toBe(mailerSuccessResponse)
      expect(sendgrid.send).toBeCalled()
    })

    it('sends outbid email', async () => {
      ;(sendgrid.send as jest.MockedFunction<typeof sendgrid.send>).mockResolvedValueOnce(mailerFailureResponse)
      const testUser: Partial<entity.User> = {
        email: testMockUser.email,
        preferences: {
          outbidNotifications: true,
          bidActivityNotifications: false,
          priceChangeNotifications: false,
          purchaseSuccessNotifications: false,
          promotionalNotifications: false,
        },
      }

      const profileUrl = 'test-profile'

      const testSendResponse = await sendgridService.sendOutbidEmail(testUser as entity.User, profileUrl)
      expect(testSendResponse).toBe(mailerSuccessResponse)
      expect(sendgrid.send).toBeCalled()
    })

    it('sends win email', async () => {
      ;(sendgrid.send as jest.MockedFunction<typeof sendgrid.send>).mockResolvedValueOnce(mailerFailureResponse)
      const topBid: Partial<entity.Bid> = {
        price: '10',
      }
      const testUser: Partial<entity.User> = {
        email: testMockUser.email,
        preferences: {
          outbidNotifications: false,
          bidActivityNotifications: false,
          priceChangeNotifications: false,
          purchaseSuccessNotifications: true,
          promotionalNotifications: false,
        },
      }

      const profileUrl = 'test-profile'
      const testSendResponse = await sendgridService.sendWinEmail(
        topBid as entity.Bid,
        testUser as entity.User,
        profileUrl,
      )
      expect(testSendResponse).toBe(mailerSuccessResponse)
      expect(sendgrid.send).toBeCalled()
    })

    it('sends marketplace bid confirmation email', async () => {
      ;(sendgrid.send as jest.MockedFunction<typeof sendgrid.send>).mockResolvedValueOnce(mailerFailureResponse)
      const testUser: Partial<entity.User> = {
        email: testMockUser.email,
        preferences: {
          outbidNotifications: false,
          bidActivityNotifications: true,
          priceChangeNotifications: false,
          purchaseSuccessNotifications: false,
          promotionalNotifications: false,
        },
      }

      const testSendResponse = await sendgridService.sendMarketplaceBidConfirmEmail(
        testMockWallet.address,
        testUser as entity.User,
      )
      expect(testSendResponse).toBe(mailerSuccessResponse)
      expect(sendgrid.send).toBeCalled()
    })
  })
})
