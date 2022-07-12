import * as sendgridService from '@nftcom/gql/service/sendgrid.service'
import sendgrid from '@sendgrid/mail'

import { testMockUser } from '../util/constants'

jest.mock('@sendgrid/mail', () => {
  return {
    setApiKey: jest.fn(),
    send: jest.fn(),
  }
})

let mailerSuccessResponse, mailerFailureResponse
describe('sendgrid service', () => {
  describe('sendgrid send confirmation email', () => {
    beforeAll(async () => {
      mailerSuccessResponse = true
      mailerFailureResponse = undefined
    })
      
    afterAll(async () => {
      jest.clearAllMocks()
    })

    it('sends confirmation email', async () => {
      (sendgrid.send as jest.MockedFunction<typeof sendgrid.send>)
        .mockResolvedValueOnce(mailerSuccessResponse)
      const testUser = {
        email: testMockUser.email,
        confirmEmailToken: 'test',
      }

      const testSendResponse = await sendgridService.sendConfirmEmail(testUser as any)
      expect(testSendResponse).toBe(mailerSuccessResponse)
      expect(sendgrid.send).toBeCalled()
    })

    it('fails to send confirmation email', async () => {
      (sendgrid.send as jest.MockedFunction<typeof sendgrid.send>)
        .mockResolvedValueOnce(mailerFailureResponse)
      const testUser = {
        email: '',
        confirmEmailToken: 'test',
      }

      const testSendResponse = await sendgridService.sendConfirmEmail(testUser as any)
      expect(testSendResponse).toBe(mailerFailureResponse)
      expect(sendgrid.send).toBeCalled()
    })
  })
})