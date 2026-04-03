/**
 * Тесты обработки ошибок
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

const openaiService = require('../src/services/openai');
const requestService = require('../src/services/requestService');
const userService = require('../src/services/userService');
const { MESSAGES } = require('../src/config/constants');

// Mock external services
jest.mock('../src/services/openai');
jest.mock('../src/services/requestService');
jest.mock('../src/services/userService');
jest.mock('../src/utils/logger');

describe('Error Handling Tests', () => {
  let mockCtx;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockCtx = {
      from: { id: 123456789 },
      chat: { id: 123456789 },
      message: {
        photo: [{ file_id: 'test_photo', width: 1280, height: 720 }]
      },
      reply: jest.fn(),
      answerCbQuery: jest.fn(),
      state: {}
    };

    // Default successful mocks
    userService.getOrCreateUser.mockResolvedValue({
      telegram_id: 123456789,
      user_class_id: 1,
      purchased_requests: 0
    });

    requestService.canMakeRequest.mockResolvedValue({
      allowed: true,
      usedPurchased: false
    });
  });

  describe('OpenAI API errors', () => {
    test('should handle OpenAI API timeout', async () => {
      // Arrange
      openaiService.analyzeFood.mockRejectedValue(new Error('Request timeout'));
      
      // Act
      const photoHandler = require('../src/bot/handlers/photo');
      await photoHandler(mockCtx);

      // Assert
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Сервис временно недоступен')
      );
    });

    test('should handle OpenAI API rate limit error', async () => {
      // Arrange
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.status = 429;
      openaiService.analyzeFood.mockRejectedValue(rateLimitError);
      
      // Act
      const photoHandler = require('../src/bot/handlers/photo');
      await photoHandler(mockCtx);

      // Assert
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Сервис временно недоступен')
      );
    });

    test('should handle OpenAI API authentication error', async () => {
      // Arrange
      const authError = new Error('Invalid API key');
      authError.status = 401;
      openaiService.analyzeFood.mockRejectedValue(authError);
      
      // Act
      const photoHandler = require('../src/bot/handlers/photo');
      await photoHandler(mockCtx);

      // Assert
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Сервис временно недоступен')
      );
    });

    test('should handle malformed OpenAI response', async () => {
      // Arrange
      openaiService.analyzeFood.mockRejectedValue(new Error('Failed to parse JSON from OpenAI response'));
      
      // Act
      const photoHandler = require('../src/bot/handlers/photo');
      await photoHandler(mockCtx);

      // Assert
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Сервис временно недоступен')
      );
    });

    test('should retry on transient errors', async () => {
      // This test verifies the retry logic in OpenAI service
      const mockClient = {
        chat: {
          completions: {
            create: jest.fn()
              .mockRejectedValueOnce(new Error('Network error'))
              .mockResolvedValueOnce({
                choices: [{
                  message: {
                    content: '{"dishName": "Test", "calories": 100, "protein": 10, "fat": 5, "carbs": 15}'
                  }
                }]
              })
          }
        }
      };

      // Mock the OpenAI client
      const OpenAI = require('openai');
      OpenAI.mockImplementation(() => mockClient);

      // Create a new instance to test retry logic
      const testService = new (require('../src/services/openai').constructor)();
      
      // Act
      const result = await testService.analyzeFood('test_url');

      // Assert
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(2);
      expect(result.dishName).toBe('Test');
    });
  });

  describe('Database errors', () => {
    test('should handle database connection error', async () => {
      // Arrange
      const dbError = new Error('Connection refused');
      dbError.code = 'ECONNREFUSED';
      userService.getOrCreateUser.mockRejectedValue(dbError);
      
      // Act
      const photoHandler = require('../src/bot/handlers/photo');
      await photoHandler(mockCtx);

      // Assert
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Произошла ошибка')
      );
    });

    test('should handle database query timeout', async () => {
      // Arrange
      const timeoutError = new Error('Query timeout');
      timeoutError.code = 'QUERY_TIMEOUT';
      requestService.saveRequest.mockRejectedValue(timeoutError);
      
      openaiService.analyzeFood.mockResolvedValue({
        dishName: 'Test',
        calories: 100,
        protein: 10,
        fat: 5,
        carbs: 15
      });
      
      // Act
      const photoHandler = require('../src/bot/handlers/photo');
      await photoHandler(mockCtx);

      // Assert
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Произошла ошибка')
      );
    });

    test('should handle constraint violation errors', async () => {
      // Arrange
      const constraintError = new Error('Duplicate key violation');
      constraintError.code = '23505';
      requestService.saveRequest.mockRejectedValue(constraintError);
      
      openaiService.analyzeFood.mockResolvedValue({
        dishName: 'Test',
        calories: 100,
        protein: 10,
        fat: 5,
        carbs: 15
      });
      
      // Act
      const photoHandler = require('../src/bot/handlers/photo');
      await photoHandler(mockCtx);

      // Assert
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Произошла ошибка')
      );
    });
  });

  describe('Network errors', () => {
    test('should handle network connectivity issues', async () => {
      // Arrange
      const networkError = new Error('Network is unreachable');
      networkError.code = 'ENETUNREACH';
      openaiService.analyzeFood.mockRejectedValue(networkError);
      
      // Act
      const photoHandler = require('../src/bot/handlers/photo');
      await photoHandler(mockCtx);

      // Assert
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Сервис временно недоступен')
      );
    });

    test('should handle DNS resolution errors', async () => {
      // Arrange
      const dnsError = new Error('getaddrinfo ENOTFOUND');
      dnsError.code = 'ENOTFOUND';
      openaiService.analyzeFood.mockRejectedValue(dnsError);
      
      // Act
      const photoHandler = require('../src/bot/handlers/photo');
      await photoHandler(mockCtx);

      // Assert
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Сервис временно недоступен')
      );
    });
  });

  describe('User-friendly error messages', () => {
    test('should provide clear message for API unavailability', async () => {
      // Arrange
      openaiService.analyzeFood.mockRejectedValue(new Error('Service unavailable'));
      
      // Act
      const photoHandler = require('../src/bot/handlers/photo');
      await photoHandler(mockCtx);

      // Assert
      const replyCall = mockCtx.reply.mock.calls[0];
      expect(replyCall[0]).toContain('⚠️');
      expect(replyCall[0]).toContain('Сервис временно недоступен');
      expect(replyCall[0]).toContain('Попробуйте позже');
    });

    test('should provide generic error message for unknown errors', async () => {
      // Arrange
      const unknownError = new Error('Something went wrong');
      userService.getOrCreateUser.mockRejectedValue(unknownError);
      
      // Act
      const photoHandler = require('../src/bot/handlers/photo');
      await photoHandler(mockCtx);

      // Assert
      expect(mockCtx.reply).toHaveBeenCalledWith(MESSAGES.ERROR);
    });

    test('should not expose internal error details to users', async () => {
      // Arrange
      const internalError = new Error('Database connection string: postgres://user:pass@host/db');
      requestService.saveRequest.mockRejectedValue(internalError);
      
      openaiService.analyzeFood.mockResolvedValue({
        dishName: 'Test',
        calories: 100,
        protein: 10,
        fat: 5,
        carbs: 15
      });
      
      // Act
      const photoHandler = require('../src/bot/handlers/photo');
      await photoHandler(mockCtx);

      // Assert
      const replyCall = mockCtx.reply.mock.calls[0];
      expect(replyCall[0]).not.toContain('postgres://');
      expect(replyCall[0]).not.toContain('connection string');
      expect(replyCall[0]).toContain('⚠️');
    });
  });

  describe('Error logging', () => {
    test('should log errors with context information', async () => {
      // Arrange
      const logger = require('../src/utils/logger');
      const testError = new Error('Test error');
      openaiService.analyzeFood.mockRejectedValue(testError);
      
      // Act
      const photoHandler = require('../src/bot/handlers/photo');
      await photoHandler(mockCtx);

      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in photo handler'),
        expect.objectContaining({
          userId: 123456789,
          error: 'Test error'
        })
      );
    });

    test('should log different error types appropriately', async () => {
      const logger = require('../src/utils/logger');
      
      // Test API error logging
      const apiError = new Error('API Error');
      apiError.status = 500;
      openaiService.analyzeFood.mockRejectedValue(apiError);
      
      const photoHandler = require('../src/bot/handlers/photo');
      await photoHandler(mockCtx);

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Graceful degradation', () => {
    test('should continue processing other requests after error', async () => {
      // Arrange
      openaiService.analyzeFood
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({
          dishName: 'Success',
          calories: 200,
          protein: 20,
          fat: 10,
          carbs: 25
        });
      
      const photoHandler = require('../src/bot/handlers/photo');
      
      // Act - First request fails
      await photoHandler(mockCtx);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Сервис временно недоступен')
      );
      
      // Reset mocks for second request
      mockCtx.reply.mockClear();
      
      // Act - Second request succeeds
      await photoHandler(mockCtx);
      
      // Assert
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🍽️ Success'),
        expect.any(Object)
      );
    });

    test('should handle partial service failures', async () => {
      // Arrange - OpenAI works but database fails
      openaiService.analyzeFood.mockResolvedValue({
        dishName: 'Test Dish',
        calories: 300,
        protein: 25,
        fat: 12,
        carbs: 35
      });
      
      requestService.saveRequest.mockRejectedValue(new Error('Database error'));
      
      // Act
      const photoHandler = require('../src/bot/handlers/photo');
      await photoHandler(mockCtx);

      // Assert - Should still attempt to provide user feedback
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('⚠️')
      );
    });
  });
});