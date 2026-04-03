/**
 * Тесты системы лимитов
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

const requestService = require('../src/services/requestService');
const userService = require('../src/services/userService');
const { PAYMENT_PACKAGES } = require('../src/config/constants');

// Mock external services
jest.mock('../src/services/userService');
jest.mock('../src/database/queries/requests');
jest.mock('../src/database/queries/users');
jest.mock('../src/utils/logger');

describe('Limits System Tests', () => {
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
  });

  describe('FREE user daily limit', () => {
    test('should allow request within daily limit', async () => {
      // Arrange
      userService.getOrCreateUser.mockResolvedValue({
        telegram_id: 123456789,
        user_class_id: 1,
        purchased_requests: 0
      });

      userService.getUserClass.mockResolvedValue({
        id: 1,
        class_name: 'FREE',
        daily_limit: 1
      });

      const requestQueries = require('../src/database/queries/requests');
      requestQueries.getTodayRequestCount.mockResolvedValue(0);

      // Act
      const result = await requestService.canMakeRequest(123456789);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.usedPurchased).toBe(false);
    });

    test('should deny request when daily limit reached and no purchased requests', async () => {
      // Arrange
      userService.getOrCreateUser.mockResolvedValue({
        telegram_id: 123456789,
        user_class_id: 1,
        purchased_requests: 0
      });

      userService.getUserClass.mockResolvedValue({
        id: 1,
        class_name: 'FREE',
        daily_limit: 1
      });

      const requestQueries = require('../src/database/queries/requests');
      requestQueries.getTodayRequestCount.mockResolvedValue(1);

      // Act
      const result = await requestService.canMakeRequest(123456789);

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Дневной лимит исчерпан');
    });

    test('should use purchased request when daily limit reached', async () => {
      // Arrange
      userService.getOrCreateUser.mockResolvedValue({
        telegram_id: 123456789,
        user_class_id: 1,
        purchased_requests: 5
      });

      userService.getUserClass.mockResolvedValue({
        id: 1,
        class_name: 'FREE',
        daily_limit: 1
      });

      const requestQueries = require('../src/database/queries/requests');
      requestQueries.getTodayRequestCount.mockResolvedValue(1);

      // Act
      const result = await requestService.canMakeRequest(123456789);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.usedPurchased).toBe(true);
    });
  });

  describe('PREMIUM user unlimited access', () => {
    test('should always allow requests for PREMIUM users', async () => {
      // Arrange
      userService.getOrCreateUser.mockResolvedValue({
        telegram_id: 123456789,
        user_class_id: 2,
        purchased_requests: 0
      });

      userService.getUserClass.mockResolvedValue({
        id: 2,
        class_name: 'PREMIUM',
        daily_limit: null
      });

      const requestQueries = require('../src/database/queries/requests');
      requestQueries.getTodayRequestCount.mockResolvedValue(100);

      // Act
      const result = await requestService.canMakeRequest(123456789);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.usedPurchased).toBe(false);
    });
  });

  describe('ADMIN user unlimited access', () => {
    test('should always allow requests for ADMIN users', async () => {
      // Arrange
      userService.getOrCreateUser.mockResolvedValue({
        telegram_id: 123456789,
        user_class_id: 3,
        purchased_requests: 0
      });

      userService.getUserClass.mockResolvedValue({
        id: 3,
        class_name: 'ADMIN',
        daily_limit: null
      });

      const requestQueries = require('../src/database/queries/requests');
      requestQueries.getTodayRequestCount.mockResolvedValue(1000);

      // Act
      const result = await requestService.canMakeRequest(123456789);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.usedPurchased).toBe(false);
    });
  });

  describe('Purchased requests handling', () => {
    test('should decrement purchased requests when used', async () => {
      // Arrange
      const userQueries = require('../src/database/queries/users');
      userQueries.updatePurchasedRequests.mockResolvedValue({
        telegram_id: 123456789,
        purchased_requests: 4
      });

      // Act
      const result = await requestService.decrementPurchasedRequest(123456789);

      // Assert
      expect(userQueries.updatePurchasedRequests).toHaveBeenCalledWith(123456789, -1);
      expect(result.purchased_requests).toBe(4);
    });
  });

  describe('Payment packages display', () => {
    test('should show payment buttons when limit reached', async () => {
      // Arrange
      const rateLimitMiddleware = require('../src/bot/middleware/rateLimit');
      
      userService.getOrCreateUser.mockResolvedValue({
        telegram_id: 123456789,
        user_class_id: 1,
        purchased_requests: 0
      });

      // Mock canMakeRequest to return false
      jest.spyOn(requestService, 'canMakeRequest').mockResolvedValue({
        allowed: false,
        reason: 'Дневной лимит исчерпан'
      });

      // Act
      const middleware = rateLimitMiddleware();
      await middleware(mockCtx, () => {});

      // Assert
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Дневной лимит исчерпан'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: expect.stringContaining('10 запросов'),
                  callback_data: 'buy_0'
                })
              ])
            ])
          })
        })
      );
    });

    test('should include all payment packages in buttons', () => {
      // Arrange & Act
      const packages = PAYMENT_PACKAGES;

      // Assert
      expect(packages).toHaveLength(3);
      expect(packages[0]).toEqual({ requests: 10, price: 99, currency: 'RUB' });
      expect(packages[1]).toEqual({ requests: 50, price: 399, currency: 'RUB' });
      expect(packages[2]).toEqual({ requests: 100, price: 699, currency: 'RUB' });
    });
  });

  describe('Rate limit middleware', () => {
    test('should pass through when request is allowed', async () => {
      // Arrange
      const rateLimitMiddleware = require('../src/bot/middleware/rateLimit');
      const nextMock = jest.fn();
      
      jest.spyOn(requestService, 'canMakeRequest').mockResolvedValue({
        allowed: true,
        usedPurchased: false
      });

      // Act
      const middleware = rateLimitMiddleware();
      await middleware(mockCtx, nextMock);

      // Assert
      expect(nextMock).toHaveBeenCalled();
      expect(mockCtx.reply).not.toHaveBeenCalled();
    });

    test('should block and show payment options when limit reached', async () => {
      // Arrange
      const rateLimitMiddleware = require('../src/bot/middleware/rateLimit');
      const nextMock = jest.fn();
      
      jest.spyOn(requestService, 'canMakeRequest').mockResolvedValue({
        allowed: false,
        reason: 'Дневной лимит исчерпан'
      });

      // Act
      const middleware = rateLimitMiddleware();
      await middleware(mockCtx, nextMock);

      // Assert
      expect(nextMock).not.toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalled();
    });

    test('should decrement purchased request when used', async () => {
      // Arrange
      const rateLimitMiddleware = require('../src/bot/middleware/rateLimit');
      const nextMock = jest.fn();
      
      jest.spyOn(requestService, 'canMakeRequest').mockResolvedValue({
        allowed: true,
        usedPurchased: true
      });
      
      jest.spyOn(requestService, 'decrementPurchasedRequest').mockResolvedValue({});

      // Act
      const middleware = rateLimitMiddleware();
      await middleware(mockCtx, nextMock);

      // Assert
      expect(requestService.decrementPurchasedRequest).toHaveBeenCalledWith(123456789);
      expect(nextMock).toHaveBeenCalled();
    });
  });
});