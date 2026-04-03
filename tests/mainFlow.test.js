/**
 * Тесты основного флоу бота
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4
 */

const { Telegraf } = require('telegraf');
const { initializeBot } = require('../src/bot/index');
const openaiService = require('../src/services/openai');
const requestService = require('../src/services/requestService');
const userService = require('../src/services/userService');
const formatter = require('../src/utils/formatter');

// Mock external services
jest.mock('../src/services/openai');
jest.mock('../src/services/requestService');
jest.mock('../src/services/userService');
jest.mock('../src/utils/logger');

describe('Main Flow Tests', () => {
  let bot;
  let mockCtx;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Initialize bot
    bot = initializeBot();
    
    // Create mock context
    mockCtx = {
      from: { id: 123456789 },
      chat: { id: 123456789 },
      message: {
        photo: [
          { file_id: 'small_photo', width: 90, height: 90 },
          { file_id: 'large_photo', width: 1280, height: 720 }
        ]
      },
      reply: jest.fn(),
      replyWithPhoto: jest.fn(),
      answerCbQuery: jest.fn(),
      editMessageText: jest.fn(),
      state: {}
    };

    // Mock user service
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

    // Mock request service
    requestService.canMakeRequest.mockResolvedValue({
      allowed: true,
      usedPurchased: false
    });

    requestService.saveRequest.mockResolvedValue({
      id: 1,
      user_telegram_id: 123456789,
      photo_file_id: 'large_photo',
      dish_name: 'Тестовое блюдо',
      calories: 350,
      protein: 25,
      fat: 15,
      carbs: 30
    });
  });

  describe('Photo without caption', () => {
    test('should process photo without weight and return formatted result', async () => {
      // Arrange
      mockCtx.message.caption = undefined;
      
      openaiService.analyzeFood.mockResolvedValue({
        dishName: 'Куриная грудка с овощами',
        calories: 350,
        protein: 25,
        fat: 15,
        carbs: 30
      });

      // Act
      const photoHandler = require('../src/bot/handlers/photo');
      await photoHandler(mockCtx);

      // Assert
      expect(openaiService.analyzeFood).toHaveBeenCalledWith('large_photo', null);
      expect(requestService.saveRequest).toHaveBeenCalledWith(
        123456789,
        'large_photo',
        {
          dishName: 'Куриная грудка с овощами',
          calories: 350,
          protein: 25,
          fat: 15,
          carbs: 30
        },
        null
      );
      
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🍽️ Куриная грудка с овощами'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: 'Корректировать результаты',
                  callback_data: 'correct_1'
                })
              ])
            ])
          })
        })
      );
    });

    test('should format nutrition data correctly', () => {
      // Arrange
      const nutritionData = {
        dishName: 'Тестовое блюдо',
        calories: 350.7,
        protein: 25.3,
        fat: 15.8,
        carbs: 30.2
      };

      // Act
      const formatted = formatter.formatNutritionData(nutritionData);

      // Assert
      expect(formatted).toContain('🍽️ Тестовое блюдо');
      expect(formatted).toContain('🔥 350.7 ккал');
      expect(formatted).toContain('🥩 25.3г белки');
      expect(formatted).toContain('🧈 15.8г жиры');
      expect(formatted).toContain('🍞 30.2г углеводы');
    });
  });

  describe('Photo with weight in caption', () => {
    test('should extract weight from caption and pass to OpenAI', async () => {
      // Arrange
      mockCtx.message.caption = 'Моя порция 250г';
      
      openaiService.analyzeFood.mockResolvedValue({
        dishName: 'Рис с курицей',
        calories: 400,
        protein: 30,
        fat: 12,
        carbs: 45
      });

      // Act
      const photoHandler = require('../src/bot/handlers/photo');
      await photoHandler(mockCtx);

      // Assert
      expect(openaiService.analyzeFood).toHaveBeenCalledWith('large_photo', 250);
      expect(requestService.saveRequest).toHaveBeenCalledWith(
        123456789,
        'large_photo',
        expect.any(Object),
        250
      );
    });

    test('should handle multiple numbers in caption and use first one', async () => {
      // Arrange
      mockCtx.message.caption = 'Порция 150г, готовил 30 минут';
      
      openaiService.analyzeFood.mockResolvedValue({
        dishName: 'Паста',
        calories: 300,
        protein: 12,
        fat: 8,
        carbs: 50
      });

      // Act
      const photoHandler = require('../src/bot/handlers/photo');
      await photoHandler(mockCtx);

      // Assert
      expect(openaiService.analyzeFood).toHaveBeenCalledWith('large_photo', 150);
    });

    test('should handle no numbers in caption', async () => {
      // Arrange
      mockCtx.message.caption = 'Вкусный обед';
      
      openaiService.analyzeFood.mockResolvedValue({
        dishName: 'Салат',
        calories: 200,
        protein: 8,
        fat: 12,
        carbs: 15
      });

      // Act
      const photoHandler = require('../src/bot/handlers/photo');
      await photoHandler(mockCtx);

      // Assert
      expect(openaiService.analyzeFood).toHaveBeenCalledWith('large_photo', null);
    });
  });

  describe('Response formatting', () => {
    test('should include correction button with correct callback data', async () => {
      // Arrange
      mockCtx.message.caption = undefined;
      
      openaiService.analyzeFood.mockResolvedValue({
        dishName: 'Тестовое блюдо',
        calories: 350,
        protein: 25,
        fat: 15,
        carbs: 30
      });

      // Act
      const photoHandler = require('../src/bot/handlers/photo');
      await photoHandler(mockCtx);

      // Assert
      const replyCall = mockCtx.reply.mock.calls[0];
      const replyMarkup = replyCall[1].reply_markup;
      
      expect(replyMarkup.inline_keyboard).toHaveLength(1);
      expect(replyMarkup.inline_keyboard[0]).toHaveLength(1);
      expect(replyMarkup.inline_keyboard[0][0]).toEqual({
        text: 'Корректировать результаты',
        callback_data: 'correct_1'
      });
    });

    test('should use largest photo size', async () => {
      // Arrange
      mockCtx.message.photo = [
        { file_id: 'small_photo', width: 90, height: 90 },
        { file_id: 'medium_photo', width: 320, height: 240 },
        { file_id: 'large_photo', width: 1280, height: 720 }
      ];
      
      openaiService.analyzeFood.mockResolvedValue({
        dishName: 'Тестовое блюдо',
        calories: 350,
        protein: 25,
        fat: 15,
        carbs: 30
      });

      // Act
      const photoHandler = require('../src/bot/handlers/photo');
      await photoHandler(mockCtx);

      // Assert
      expect(openaiService.analyzeFood).toHaveBeenCalledWith('large_photo', null);
    });
  });
});