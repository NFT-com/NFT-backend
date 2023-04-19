import { generateSVG } from 'packages/service/src/lib/generateSVG.service'

const profileURL = 'testProfile',
  base64String = 'testBase64String'
describe('generateSVG service', () => {
  describe('generateSVG', () => {
    // Test SVG has profileURL and base64String
    it('generates SVG', async () => {
      const generatedSVG = generateSVG(profileURL, base64String)
      expect(generatedSVG).toContain('svg')
      expect(generatedSVG).toContain(profileURL)
      expect(generatedSVG).toContain(base64String)
    })
  })
})
