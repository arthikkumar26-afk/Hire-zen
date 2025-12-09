import { z } from 'zod';
import logger from '../utils/logger.js';

/**
 * Validation middleware factory
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {string} type - 'body' | 'query' | 'params'
 */
export const validate = (schema, type = 'body') => {
  return (req, res, next) => {
    try {
      const data = type === 'body' ? req.body : type === 'query' ? req.query : req.params;
      
      // Validate data against schema
      const result = schema.safeParse(data);
      
      if (!result.success) {
        logger.warn({
          path: req.path,
          method: req.method,
          validationErrors: result.error.errors,
        }, 'Validation failed');
        
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'Invalid request data',
          errors: result.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      
      // Replace request data with validated/parsed data
      if (type === 'body') {
        req.body = result.data;
      } else if (type === 'query') {
        req.query = result.data;
      } else {
        req.params = result.data;
      }
      
      next();
    } catch (error) {
      logger.error({ error, path: req.path }, 'Validation middleware error');
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Validation failed',
      });
    }
  };
};

/**
 * Validate multiple schemas at once
 */
export const validateMultiple = (validations) => {
  return (req, res, next) => {
    try {
      for (const { schema, type } of validations) {
        const data = type === 'body' ? req.body : type === 'query' ? req.query : req.params;
        const result = schema.safeParse(data);
        
        if (!result.success) {
          logger.warn({
            path: req.path,
            method: req.method,
            type,
            validationErrors: result.error.errors,
          }, 'Validation failed');
          
          return res.status(400).json({
            success: false,
            error: 'Validation error',
            message: 'Invalid request data',
            errors: result.error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          });
        }
        
        if (type === 'body') {
          req.body = result.data;
        } else if (type === 'query') {
          req.query = result.data;
        } else {
          req.params = result.data;
        }
      }
      
      next();
    } catch (error) {
      logger.error({ error, path: req.path }, 'Validation middleware error');
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Validation failed',
      });
    }
  };
};


