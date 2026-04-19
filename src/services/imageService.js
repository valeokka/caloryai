/**
 * Сервис для работы с изображениями (сжатие, оптимизация)
 */

const sharp = require('sharp');
const https = require('https');
const http = require('http');
const logger = require('../utils/logger');
const { IMAGE, VALIDATION } = require('../config/constants');

// Максимальный размер для скачивания (20MB)
const MAX_DOWNLOAD_SIZE = 20 * 1024 * 1024;

class ImageService {
  /**
   * Скачать и сжать изображение
   * @param {string} imageUrl - URL изображения
   * @returns {Promise<Buffer>} Сжатое изображение
   */
  async downloadAndCompress(imageUrl) {
    try {
      if (!IMAGE.COMPRESSION_ENABLED) {
        logger.info('Image compression disabled, skipping');
        return null;
      }

      const startTime = Date.now();
      logger.info('Downloading and compressing image', { imageUrl });

      // Скачиваем изображение
      const imageBuffer = await this._downloadImage(imageUrl);
      const originalSize = imageBuffer.length;

      // Получаем метаданные изображения
      const metadata = await sharp(imageBuffer).metadata();
      logger.info('Original image metadata', {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: `${(originalSize / 1024).toFixed(2)}KB`
      });

      // Проверяем, нужно ли сжимать
      const needsResize = metadata.width > IMAGE.MAX_WIDTH || metadata.height > IMAGE.MAX_HEIGHT;
      const needsConversion = metadata.format !== IMAGE.FORMAT;

      if (!needsResize && !needsConversion && originalSize < 1024 * 1024) {
        // Изображение уже оптимально (меньше 1MB и правильный размер)
        logger.info('Image already optimal, skipping compression');
        return null;
      }

      // Сжимаем изображение
      let sharpInstance = sharp(imageBuffer);

      // Изменяем размер если нужно
      if (needsResize) {
        sharpInstance = sharpInstance.resize(IMAGE.MAX_WIDTH, IMAGE.MAX_HEIGHT, {
          fit: 'inside',  // сохраняем пропорции
          withoutEnlargement: true  // не увеличиваем маленькие изображения
        });
      }

      // Конвертируем в нужный формат
      if (IMAGE.FORMAT === 'jpeg') {
        sharpInstance = sharpInstance.jpeg({
          quality: IMAGE.QUALITY,
          progressive: true,
          mozjpeg: true  // используем mozjpeg для лучшего сжатия
        });
      } else if (IMAGE.FORMAT === 'webp') {
        sharpInstance = sharpInstance.webp({
          quality: IMAGE.QUALITY
        });
      } else if (IMAGE.FORMAT === 'png') {
        sharpInstance = sharpInstance.png({
          compressionLevel: 9,
          adaptiveFiltering: true
        });
      }

      const compressedBuffer = await sharpInstance.toBuffer();
      const compressedSize = compressedBuffer.length;
      const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
      const duration = Date.now() - startTime;

      logger.info('Image compressed successfully', {
        originalSize: `${(originalSize / 1024).toFixed(2)}KB`,
        compressedSize: `${(compressedSize / 1024).toFixed(2)}KB`,
        compressionRatio: `${compressionRatio}%`,
        duration: `${duration}ms`
      });

      return compressedBuffer;
    } catch (error) {
      logger.error('Error compressing image', {
        imageUrl,
        error: error.message,
        stack: error.stack
      });
      // Возвращаем null, чтобы использовать оригинальный URL
      return null;
    }
  }

  /**
   * Скачать изображение по URL с проверкой размера
   * @param {string} url - URL изображения
   * @returns {Promise<Buffer>} Буфер с изображением
   */
  _downloadImage(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      
      protocol.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: ${response.statusCode}`));
          return;
        }

        // Проверяем размер до скачивания
        const contentLength = parseInt(response.headers['content-length'], 10);
        if (contentLength && contentLength > MAX_DOWNLOAD_SIZE) {
          reject(new Error(`Image too large: ${(contentLength / 1024 / 1024).toFixed(2)}MB (max: ${MAX_DOWNLOAD_SIZE / 1024 / 1024}MB)`));
          response.destroy();
          return;
        }

        const chunks = [];
        let downloadedSize = 0;

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          
          // Проверяем размер во время скачивания
          if (downloadedSize > MAX_DOWNLOAD_SIZE) {
            reject(new Error(`Image exceeded size limit during download: ${(downloadedSize / 1024 / 1024).toFixed(2)}MB`));
            response.destroy();
            return;
          }
          
          chunks.push(chunk);
        });

        response.on('end', () => {
          logger.info('Image downloaded', { 
            size: `${(downloadedSize / 1024).toFixed(2)}KB` 
          });
          resolve(Buffer.concat(chunks));
        });

        response.on('error', reject);
      }).on('error', reject);
    });
  }

  /**
   * Конвертировать Buffer в base64 data URL
   * @param {Buffer} buffer - Буфер изображения
   * @param {string} format - Формат изображения
   * @returns {string} Data URL
   */
  bufferToDataUrl(buffer, format = 'jpeg') {
    const base64 = buffer.toString('base64');
    return `data:image/${format};base64,${base64}`;
  }
}

module.exports = new ImageService();
