/**
 * Helper Utilities
 * Contains utility functions used throughout the application
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const moment = require('moment-timezone');
const {
  USER_ROLES,
  SUBMISSION_STATUS,
  REQUIREMENT_STATUS,
  TRUST_POINTS,
  AI_MATCH_THRESHOLDS,
  PASSWORD_REQUIREMENTS,
  LINKEDIN_URL_REGEX,
  EMAIL_REGEX,
  PHONE_REGEX,
  DEFAULT_TIMEZONE,
  DATE_FORMATS,
  ERROR_CODES,
  CURRENCIES
} = require('./constants');

/**
 * Authentication & Security Helpers
 */
class AuthHelpers {
  /**
   * Generate secure random token
   * @param {number} length - Token length
   * @returns {string} Random token
   */
  static generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate secure password reset token
   * @returns {string} Reset token
   */
  static generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  static async hashPassword(password) {
    return await bcrypt.hash(password, 12);
  }

  /**
   * Compare password with hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} Match result
   */
  static async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT token
   * @param {object} payload - Token payload
   * @param {string} secret - JWT secret
   * @param {string} expiresIn - Expiration time
   * @returns {string} JWT token
   */
  static generateJWT(payload, secret, expiresIn = '7d') {
    return jwt.sign(payload, secret, { expiresIn });
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @param {string} secret - JWT secret
   * @returns {object} Decoded payload
   */
  static verifyJWT(token, secret) {
    return jwt.verify(token, secret);
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {object} Validation result
   */
  static validatePassword(password) {
    const result = {
      isValid: true,
      errors: []
    };

    if (password.length < PASSWORD_REQUIREMENTS.MIN_LENGTH) {
      result.isValid = false;
      result.errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.MIN_LENGTH} characters long`);
    }

    if (PASSWORD_REQUIREMENTS.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      result.isValid = false;
      result.errors.push('Password must contain at least one uppercase letter');
    }

    if (PASSWORD_REQUIREMENTS.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
      result.isValid = false;
      result.errors.push('Password must contain at least one lowercase letter');
    }

    if (PASSWORD_REQUIREMENTS.REQUIRE_NUMBER && !/\d/.test(password)) {
      result.isValid = false;
      result.errors.push('Password must contain at least one number');
    }

    if (PASSWORD_REQUIREMENTS.REQUIRE_SPECIAL_CHAR && !/[@$!%*?&]/.test(password)) {
      result.isValid = false;
      result.errors.push('Password must contain at least one special character (@$!%*?&)');
    }

    return result;
  }
}

/**
 * Validation Helpers
 */
class ValidationHelpers {
  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} Validation result
   */
  static isValidEmail(email) {
    return EMAIL_REGEX.test(email);
  }

  /**
   * Validate phone number format
   * @param {string} phone - Phone number to validate
   * @returns {boolean} Validation result
   */
  static isValidPhone(phone) {
    if (!phone) return true; // Phone is optional
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    return PHONE_REGEX.test(cleanPhone);
  }

  /**
   * Validate LinkedIn URL
   * @param {string} url - LinkedIn URL to validate
   * @returns {boolean} Validation result
   */
  static isValidLinkedInUrl(url) {
    return LINKEDIN_URL_REGEX.test(url);
  }

  /**
   * Validate MongoDB ObjectId
   * @param {string} id - ID to validate
   * @returns {boolean} Validation result
   */
  static isValidObjectId(id) {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }

  /**
   * Validate user role
   * @param {string} role - Role to validate
   * @returns {boolean} Validation result
   */
  static isValidUserRole(role) {
    return Object.values(USER_ROLES).includes(role);
  }

  /**
   * Validate submission status
   * @param {string} status - Status to validate
   * @returns {boolean} Validation result
   */
  static isValidSubmissionStatus(status) {
    return Object.values(SUBMISSION_STATUS).includes(status);
  }

  /**
   * Validate requirement status
   * @param {string} status - Status to validate
   * @returns {boolean} Validation result
   */
  static isValidRequirementStatus(status) {
    return Object.values(REQUIREMENT_STATUS).includes(status);
  }

  /**
   * Sanitize user input
   * @param {string} input - Input to sanitize
   * @returns {string} Sanitized input
   */
  static sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input.trim().replace(/[<>]/g, '');
  }

  /**
   * Validate file type
   * @param {string} mimetype - File mimetype
   * @param {array} allowedTypes - Allowed mimetypes
   * @returns {boolean} Validation result
   */
  static isValidFileType(mimetype, allowedTypes) {
    return allowedTypes.includes(mimetype);
  }

  /**
   * Validate file size
   * @param {number} size - File size in bytes
   * @param {number} maxSize - Maximum allowed size
   * @returns {boolean} Validation result
   */
  static isValidFileSize(size, maxSize) {
    return size <= maxSize;
  }
}

/**
 * Data Formatting Helpers
 */
class FormatHelpers {
  /**
   * Format user name
   * @param {object} user - User object
   * @returns {string} Formatted name
   */
  static formatUserName(user) {
    if (!user) return 'Unknown';
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  }

  /**
   * Format currency amount
   * @param {number} amount - Amount to format
   * @param {string} currency - Currency code
   * @returns {string} Formatted amount
   */
  static formatCurrency(amount, currency = CURRENCIES.USD) {
    if (!amount && amount !== 0) return 'N/A';
    
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    
    return formatter.format(amount);
  }

  /**
   * Format file size
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format percentage
   * @param {number} value - Value to format as percentage
   * @param {number} decimals - Number of decimal places
   * @returns {string} Formatted percentage
   */
  static formatPercentage(value, decimals = 1) {
    if (!value && value !== 0) return '0%';
    return `${value.toFixed(decimals)}%`;
  }

  /**
   * Format phone number
   * @param {string} phone - Phone number to format
   * @returns {string} Formatted phone number
   */
  static formatPhoneNumber(phone) {
    if (!phone) return '';
    
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX for US numbers
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    
    return phone; // Return original if not standard format
  }

  /**
   * Truncate text
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  static truncateText(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Convert to title case
   * @param {string} str - String to convert
   * @returns {string} Title case string
   */
  static toTitleCase(str) {
    if (!str) return '';
    return str.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }
}

/**
 * Date & Time Helpers
 */
class DateHelpers {
  /**
   * Format date
   * @param {Date|string} date - Date to format
   * @param {string} format - Format string
   * @param {string} timezone - Timezone
   * @returns {string} Formatted date
   */
  static formatDate(date, format = DATE_FORMATS.DISPLAY, timezone = DEFAULT_TIMEZONE) {
    if (!date) return '';
    return moment.tz(date, timezone).format(format);
  }

  /**
   * Get relative time (time ago)
   * @param {Date|string} date - Date to compare
   * @returns {string} Relative time
   */
  static getTimeAgo(date) {
    if (!date) return '';
    return moment(date).fromNow();
  }

  /**
   * Check if date is past
   * @param {Date|string} date - Date to check
   * @returns {boolean} True if past
   */
  static isPastDate(date) {
    return moment(date).isBefore(moment());
  }

  /**
   * Check if date is future
   * @param {Date|string} date - Date to check
   * @returns {boolean} True if future
   */
  static isFutureDate(date) {
    return moment(date).isAfter(moment());
  }

  /**
   * Get days between dates
   * @param {Date|string} date1 - First date
   * @param {Date|string} date2 - Second date
   * @returns {number} Days between
   */
  static getDaysBetween(date1, date2) {
    return moment(date2).diff(moment(date1), 'days');
  }

  /**
   * Add days to date
   * @param {Date|string} date - Base date
   * @param {number} days - Days to add
   * @returns {Date} New date
   */
  static addDays(date, days) {
    return moment(date).add(days, 'days').toDate();
  }

  /**
   * Get start of day
   * @param {Date|string} date - Date
   * @returns {Date} Start of day
   */
  static getStartOfDay(date) {
    return moment(date).startOf('day').toDate();
  }

  /**
   * Get end of day
   * @param {Date|string} date - Date
   * @returns {Date} End of day
   */
  static getEndOfDay(date) {
    return moment(date).endOf('day').toDate();
  }
}

/**
 * Business Logic Helpers
 */
class BusinessHelpers {
  /**
   * Calculate trust points for submission status
   * @param {string} status - Submission status
   * @returns {number} Trust points
   */
  static calculateTrustPoints(status) {
    return TRUST_POINTS[status.toUpperCase()] || 0;
  }

  /**
   * Get AI match level based on score
   * @param {number} score - Match score
   * @returns {string} Match level
   */
  static getAIMatchLevel(score) {
    if (score >= AI_MATCH_THRESHOLDS.EXCELLENT) return 'Excellent';
    if (score >= AI_MATCH_THRESHOLDS.GOOD) return 'Good';
    if (score >= AI_MATCH_THRESHOLDS.FAIR) return 'Fair';
    return 'Poor';
  }

  /**
   * Get trust point milestone
   * @param {number} points - Current trust points
   * @returns {object} Milestone info
   */
  static getTrustPointMilestone(points) {
    const milestones = Object.entries(TRUST_POINTS.MILESTONES)
      .sort((a, b) => a[1].threshold - b[1].threshold);

    let currentMilestone = null;
    let nextMilestone = null;

    for (const [name, data] of milestones) {
      if (points >= data.threshold) {
        currentMilestone = { name, ...data };
      } else if (!nextMilestone) {
        nextMilestone = { name, ...data };
        break;
      }
    }

    return {
      current: currentMilestone,
      next: nextMilestone,
      progress: nextMilestone ? 
        ((points - (currentMilestone?.threshold || 0)) / 
         (nextMilestone.threshold - (currentMilestone?.threshold || 0))) * 100 : 100
    };
  }

  /**
   * Mask client name for recruiters
   * @param {string} clientName - Original client name
   * @returns {string} Masked client name
   */
  static maskClientName(clientName) {
    if (!clientName) return '';
    
    const words = clientName.split(' ');
    return words.map(word => {
      if (word.length <= 2) return word;
      return word.charAt(0) + '*'.repeat(word.length - 2) + word.charAt(word.length - 1);
    }).join(' ');
  }

  /**
   * Calculate success rate
   * @param {number} successful - Successful count
   * @param {number} total - Total count
   * @returns {number} Success rate percentage
   */
  static calculateSuccessRate(successful, total) {
    if (!total || total === 0) return 0;
    return Math.round((successful / total) * 100);
  }

  /**
   * Generate unique filename
   * @param {string} originalName - Original filename
   * @param {string} prefix - Filename prefix
   * @returns {string} Unique filename
   */
  static generateUniqueFilename(originalName, prefix = '') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    
    return `${prefix}${timestamp}_${random}_${baseName}${extension}`;
  }

  /**
   * Clean phone number
   * @param {string} phone - Phone number to clean
   * @returns {string} Cleaned phone number
   */
  static cleanPhoneNumber(phone) {
    if (!phone) return '';
    return phone.replace(/[\s\-\(\)]/g, '');
  }
}

/**
 * File & Path Helpers
 */
class FileHelpers {
  /**
   * Ensure directory exists
   * @param {string} dirPath - Directory path
   */
  static async ensureDirectory(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Delete file safely
   * @param {string} filePath - File path to delete
   * @returns {boolean} Success status
   */
  static async deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.warn(`Could not delete file ${filePath}:`, error.message);
      return false;
    }
  }

  /**
   * Get file extension
   * @param {string} filename - Filename
   * @returns {string} File extension
   */
  static getFileExtension(filename) {
    return path.extname(filename).toLowerCase();
  }

  /**
   * Get file size
   * @param {string} filePath - File path
   * @returns {Promise<number>} File size in bytes
   */
  static async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * Check if file exists
   * @param {string} filePath - File path
   * @returns {Promise<boolean>} File exists
   */
  static async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Response Helpers
 */
class ResponseHelpers {
  /**
   * Create success response
   * @param {object} data - Response data
   * @param {string} message - Success message
   * @param {object} meta - Additional metadata
   * @returns {object} Success response
   */
  static success(data = null, message = 'Success', meta = {}) {
    return {
      success: true,
      message,
      data,
      ...meta
    };
  }

  /**
   * Create error response
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {object} details - Error details
   * @returns {object} Error response
   */
  static error(message = 'An error occurred', code = ERROR_CODES.INTERNAL_SERVER_ERROR, details = null) {
    return {
      success: false,
      message,
      code,
      ...(details && { details })
    };
  }

  /**
   * Create pagination metadata
   * @param {number} page - Current page
   * @param {number} limit - Items per page
   * @param {number} total - Total items
   * @returns {object} Pagination metadata
   */
  static createPaginationMeta(page, limit, total) {
    return {
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }
}

/**
 * Array & Object Helpers
 */
class ArrayHelpers {
  /**
   * Remove duplicates from array
   * @param {array} array - Array with duplicates
   * @param {string} key - Key to check for objects
   * @returns {array} Array without duplicates
   */
  static removeDuplicates(array, key = null) {
    if (!Array.isArray(array)) return [];
    
    if (key) {
      const seen = new Set();
      return array.filter(item => {
        const value = item[key];
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
      });
    }
    
    return [...new Set(array)];
  }

  /**
   * Group array by key
   * @param {array} array - Array to group
   * @param {string} key - Key to group by
   * @returns {object} Grouped object
   */
  static groupBy(array, key) {
    if (!Array.isArray(array)) return {};
    
    return array.reduce((groups, item) => {
      const group = item[key];
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  }

  /**
   * Sort array by key
   * @param {array} array - Array to sort
   * @param {string} key - Key to sort by
   * @param {string} order - Sort order (asc/desc)
   * @returns {array} Sorted array
   */
  static sortBy(array, key, order = 'asc') {
    if (!Array.isArray(array)) return [];
    
    return array.sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      
      if (order === 'desc') {
        return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
      }
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    });
  }

  /**
   * Chunk array into smaller arrays
   * @param {array} array - Array to chunk
   * @param {number} size - Chunk size
   * @returns {array} Array of chunks
   */
  static chunk(array, size) {
    if (!Array.isArray(array)) return [];
    
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

module.exports = {
  AuthHelpers,
  ValidationHelpers,
  FormatHelpers,
  DateHelpers,
  BusinessHelpers,
  FileHelpers,
  ResponseHelpers,
  ArrayHelpers
};