/**
 * Тесты корректировки результатов
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

const { correctionHandler, handleCorrectionInput } = require('../src/bot/handlers/correction');
const requestService = require('../src/services/requestService');
const validator = require('../src/utils/validator');

// Mock external services
jest.mock('../src/services/requestService');
jest.mock('../src/utils/logger');

describe('Correction System Tests', () => {
  let mockCtx;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockCtx = {
      from: { id: 123456789 },
      chat: { id: 123456789 },
      callbackQuery: {
        data: 'correct_1',
        message: {
          message_id: 100,
          text: '🍽️ Тестовое блюдо\n🔥 350.0 ккал\n🥩 25.0г белки\n🧈 15.0г жиры\n🍞 30.0г углеводы'
        }
      },
      message: {
        text: '400'
      },
      reply: jest.fn(),
      answerCbQuery: jest.fn(),
      editMessageText: jest.fn(),
      editMessageReplyMarkup: jest.fn(),
      state: {}
    };

    // Mock request service
    requestService.updateRequest.mockResolvedValue({
      id: 1,
      dish_name: 'Тестовое блюдо',
      calories: 400,
      protein: 25,
      fat: 15,
      carbs: 30
    });
  });

  describe('Correction menu display', () => {
    test('should show correction options when correct button clicked', async () => {
      // Act
      await correctionHandler(mockCtx);

      // Assert
      expect(mockCtx.answerCbQuery).toHaveBeenCalled();
      expect(mockCtx.editMessageReplyMarkup).toHaveBeenCalledWith({
        inline_keyboard: [
          [
            { text: '🔥 Калории', callback_data: 'edit_calories_1' },
            { text: '🥩 Белки', callback_data: 'edit_protein_1' }
          ],
          [
            { text: '🧈 Жиры', callback_data: 'edit_fat_1' },
            { text: '🍞 Углеводы', callback_data: 'edit_carbs_1' }
          ],
          [
            { text: '❌ Отмена', callback_data: 'cancel_correction_1' }
          ]
        ]
      });
    });

    test('should handle parameter selection', async () => {
      // Arrange
      mockCtx.callbackQuery.data = 'edit_calories_1';

      // Act
      await correctionHandler(mockCtx);

      // Assert
      expect(mockCtx.answerCbQuery).toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledWith(
        'Введите новое значение для калорий (число):'
      );
      expect(mockCtx.state.correctionMode).toEqual({
        requestId: 1,
        parameter: 'calories'
      });
    });

    test('should handle each parameter type', async () => {
      const parameters = [
        { callback: 'edit_protein_1', param: 'protein', name: 'белков' },
        { callback: 'edit_fat_1', param: 'fat', name: 'жиров' },
        { callback: 'edit_carbs_1', param: 'carbs', name: 'углеводов' }
      ];

      for (const { callback, param, name } of parameters) {
        mockCtx.callbackQuery.data = callback;
        
        await correctionHandler(mockCtx);
        
        expect(mockCtx.reply).toHaveBeenCalledWith(
          `Введите новое значение для ${name} (число):`
        );
        expect(mockCtx.state.correctionMode).toEqual({
          requestId: 1,
          parameter: param
        });
        
        jest.clearAllMocks();
      }
    });
  });

  describe('Input validation', () => {
    beforeEach(() => {
      mockCtx.state.correctionMode = {
        requestId: 1,
        parameter: 'calories'
      };
    });

    test('should accept valid positive number', async () => {
      // Arrange
      mockCtx.message.text = '400';

      // Act
      await handleCorrectionInput(mockCtx);

      // Assert
      expect(requestService.updateRequest).toHaveBeenCalledWith(1, {
        calories: 400
      });
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('✅ Калории обновлены')
      );
    });

    test('should accept decimal numbers', async () => {
      // Arrange
      mockCtx.message.text = '350.5';

      // Act
      await handleCorrectionInput(mockCtx);

      // Assert
      expect(requestService.updateRequest).toHaveBeenCalledWith(1, {
        calories: 350.5
      });
    });

    test('should reject negative numbers', async () => {
      // Arrange
      mockCtx.message.text = '-100';

      // Act
      await handleCorrectionInput(mockCtx);

      // Assert
      expect(requestService.updateRequest).not.toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledWith(
        '❌ Пожалуйста, введите положительное число'
      );
    });

    test('should reject zero', async () => {
      // Arrange
      mockCtx.message.text = '0';

      // Act
      await handleCorrectionInput(mockCtx);

      // Assert
      expect(requestService.updateRequest).not.toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledWith(
        '❌ Пожалуйста, введите положительное число'
      );
    });

    test('should reject non-numeric input', async () => {
      // Arrange
      mockCtx.message.text = 'abc';

      // Act
      await handleCorrectionInput(mockCtx);

      // Assert
      expect(requestService.updateRequest).not.toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledWith(
        '❌ Пожалуйста, введите положительное число'
      );
    });

    test('should reject empty input', async () => {
      // Arrange
      mockCtx.message.text = '';

      // Act
      await handleCorrectionInput(mockCtx);

      // Assert
      expect(requestService.updateRequest).not.toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledWith(
        '❌ Пожалуйста, введите положительное число'
      );
    });
  });

  describe('Database updates', () => {
    beforeEach(() => {
      mockCtx.state.correctionMode = {
        requestId: 1,
        parameter: 'calories'
      };
      mockCtx.message.text = '400';
    });

    test('should save changes to database', async () => {
      // Act
      await handleCorrectionInput(mockCtx);

      // Assert
      expect(requestService.updateRequest).toHaveBeenCalledWith(1, {
        calories: 400
      });
    });

    test('should update each parameter correctly', async () => {
      const parameters = [
        { param: 'protein', value: '30' },
        { param: 'fat', value: '20' },
        { param: 'carbs', value: '45' }
      ];

      for (const { param, value } of parameters) {
        mockCtx.state.correctionMode.parameter = param;
        mockCtx.message.text = value;
        
        await handleCorrectionInput(mockCtx);
        
        expect(requestService.updateRequest).toHaveBeenCalledWith(1, {
          [param]: parseFloat(value)
        });
        
        jest.clearAllMocks();
        requestService.updateRequest.mockResolvedValue({
          id: 1,
          dish_name: 'Тестовое блюдо',
          [param]: parseFloat(value)
        });
      }
    });

    test('should clear correction mode after successful update', async () => {
      // Act
      await handleCorrectionInput(mockCtx);

      // Assert
      expect(mockCtx.state.correctionMode).toBeUndefined();
    });
  });

  describe('Cancel correction', () => {
    test('should cancel correction and restore original buttons', async () => {
      // Arrange
      mockCtx.callbackQuery.data = 'cancel_correction_1';

      // Act
      await correctionHandler(mockCtx);

      // Assert
      expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Отменено');
      expect(mockCtx.editMessageReplyMarkup).toHaveBeenCalledWith({
        inline_keyboard: [
          [
            {
              text: 'Корректировать результаты',
              callback_data: 'correct_1'
            }
          ]
        ]
      });
    });
  });

  describe('Validator utility', () => {
    test('should validate positive numbers correctly', () => {
      expect(validator.isPositiveNumber('100')).toBe(true);
      expect(validator.isPositiveNumber('0.1')).toBe(true);
      expect(validator.isPositiveNumber('999.99')).toBe(true);
      
      expect(validator.isPositiveNumber('0')).toBe(false);
      expect(validator.isPositiveNumber('-1')).toBe(false);
      expect(validator.isPositiveNumber('abc')).toBe(false);
      expect(validator.isPositiveNumber('')).toBe(false);
      expect(validator.isPositiveNumber(null)).toBe(false);
      expect(validator.isPositiveNumber(undefined)).toBe(false);
    });

    test('should validate nutrition values', () => {
      expect(validator.validateNutritionValue(100)).toBe(true);
      expect(validator.validateNutritionValue(0.1)).toBe(true);
      expect(validator.validateNutritionValue(999.99)).toBe(true);
      
      expect(validator.validateNutritionValue(0)).toBe(false);
      expect(validator.validateNutritionValue(-1)).toBe(false);
      expect(validator.validateNutritionValue('abc')).toBe(false);
      expect(validator.validateNutritionValue(null)).toBe(false);
      expect(validator.validateNutritionValue(undefined)).toBe(false);
    });
  });
});