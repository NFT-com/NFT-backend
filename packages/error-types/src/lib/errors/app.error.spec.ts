import {
  buildCustom,
  buildExists,
  buildForbidden,
  buildInternal,
  buildInvalid,
  buildInvalidSchema,
  buildNotFound,
} from './app.error'

describe('app error', () => {
  describe('buildCustom', () => {
    it('sets a message', () => {
      const messageToTest = 'custom error message'
      const appError = buildCustom(messageToTest)
      expect(appError.message).toBe(messageToTest)
      expect(appError.extensions.code).toBe('500')
      expect(appError.extensions.errorKey).toBe('INTERNAL_ERROR')
    })
  })
  describe('buildInternal', () => {
    it('uses default settings', () => {
      const appError = buildInternal()
      expect(appError.message).toBe('Internal server error')
      expect(appError.extensions.code).toBe('500')
      expect(appError.extensions.errorKey).toBe('INTERNAL_ERROR')
    })
  })
  describe('buildInvalidSchema', () => {
    it('uses default settings', () => {
      const appError = buildInvalidSchema(new Error('property "x" is required'))
      expect(appError.message).toBe('Invalid schema provided: Error: property "x" is required')
      expect(appError.extensions.code).toBe('400')
      expect(appError.extensions.errorKey).toBe('INVALID_SCHEMA')
    })
  })
  describe('buildNotFound', () => {
    it('sets a message and error key', () => {
      const messageToTest = 'object not found'
      const errorKeyToTest = 'NOT_FOUND'
      const appError = buildNotFound(messageToTest, errorKeyToTest)
      expect(appError.message).toBe(messageToTest)
      expect(appError.extensions.code).toBe('404')
      expect(appError.extensions.errorKey).toBe(errorKeyToTest)
    })
  })
  describe('buildExists', () => {
    it('sets a message and error key', () => {
      const messageToTest = 'object already exists'
      const errorKeyToTest = 'CONFLICT'
      const appError = buildExists(messageToTest, errorKeyToTest)
      expect(appError.message).toBe(messageToTest)
      expect(appError.extensions.code).toBe('409')
      expect(appError.extensions.errorKey).toBe(errorKeyToTest)
    })
  })
  describe('buildInvalid', () => {
    it('sets a message and error key', () => {
      const messageToTest = 'object is not valid'
      const errorKeyToTest = 'INVALID'
      const appError = buildInvalid(messageToTest, errorKeyToTest)
      expect(appError.message).toBe(messageToTest)
      expect(appError.extensions.code).toBe('400')
      expect(appError.extensions.errorKey).toBe(errorKeyToTest)
    })
  })
  describe('buildForbidden', () => {
    it('sets a message and error key', () => {
      const messageToTest = 'cannot access object'
      const errorKeyToTest = 'FORBIDDEN'
      const appError = buildForbidden(messageToTest, errorKeyToTest)
      expect(appError.message).toBe(messageToTest)
      expect(appError.extensions.code).toBe('403')
      expect(appError.extensions.errorKey).toBe(errorKeyToTest)
    })
  })
})
