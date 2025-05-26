/**
 * Application Constants
 * Contains all the constant values used throughout the application
 */

// User Roles
const USER_ROLES = {
    SYSTEM_ADMIN: 'system_admin',
    CLIENT_ADMIN: 'client_admin',
    RECRUITER: 'recruiter'
  };
  
  // User Status
  const USER_STATUS = {
    ACTIVE: true,
    INACTIVE: false
  };
  
  // Submission Status
  const SUBMISSION_STATUS = {
    SUBMITTED: 'submitted',
    SCREENING: 'screening',
    INTERVIEW: 'interview',
    FINAL: 'final',
    SELECTED: 'selected',
    REJECTED: 'rejected'
  };
  
  // Requirement Status
  const REQUIREMENT_STATUS = {
    ACTIVE: 'active',
    PAUSED: 'paused',
    CLOSED: 'closed',
    FILLED: 'filled'
  };
  
  // Requirement Priority Levels
  const REQUIREMENT_PRIORITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
  };
  
  // Trust Points System
  const TRUST_POINTS = {
    SUBMISSION: 5,
    SCREENING: 10,
    INTERVIEW: 15,
    FINAL: 25,
    SELECTED: 100,
    REJECTED: 0,
    // Milestone rewards
    MILESTONES: {
      BRONZE: { threshold: 100, bonus: 50 },
      SILVER: { threshold: 500, bonus: 100 },
      GOLD: { threshold: 1000, bonus: 200 },
      PLATINUM: { threshold: 2500, bonus: 500 },
      DIAMOND: { threshold: 5000, bonus: 1000 }
    }
  };
  
  // AI Match Score Thresholds
  const AI_MATCH_THRESHOLDS = {
    EXCELLENT: 90,
    GOOD: 75,
    FAIR: 60,
    POOR: 40
  };
  
  // File Upload Limits
  const FILE_LIMITS = {
    RESUME: {
      MAX_SIZE: 10 * 1024 * 1024, // 10MB
      ALLOWED_TYPES: ['application/pdf'],
      ALLOWED_EXTENSIONS: ['.pdf']
    },
    PROFILE_PICTURE: {
      MAX_SIZE: 5 * 1024 * 1024, // 5MB
      ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/jpg'],
      ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png']
    },
    BULK_IMPORT: {
      MAX_SIZE: 50 * 1024 * 1024, // 50MB
      ALLOWED_TYPES: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ALLOWED_EXTENSIONS: ['.csv', '.xls', '.xlsx']
    }
  };
  
  // Rate Limiting
  const RATE_LIMITS = {
    AUTH: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_ATTEMPTS: 3
    },
    GENERAL: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 100
    },
    AI_ANALYSIS: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 10
    },
    HEAVY_AI: {
      WINDOW_MS: 5 * 60 * 1000, // 5 minutes
      MAX_REQUESTS: 3
    }
  };
  
  // Pagination Defaults
  const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100
  };
  
  // Interview Types
  const INTERVIEW_TYPES = {
    PHONE: 'phone',
    VIDEO: 'video',
    IN_PERSON: 'in-person',
    TECHNICAL: 'technical',
    HR: 'hr'
  };
  
  // Feedback Categories
  const FEEDBACK_CATEGORIES = {
    TECHNICAL: 'technical',
    COMMUNICATION: 'communication',
    CULTURAL_FIT: 'cultural_fit',
    EXPERIENCE: 'experience',
    OVERALL: 'overall'
  };
  
  // Currency Options
  const CURRENCIES = {
    USD: 'USD',
    EUR: 'EUR',
    GBP: 'GBP',
    INR: 'INR',
    CAD: 'CAD',
    AUD: 'AUD'
  };
  
  // Experience Range (in years)
  const EXPERIENCE_RANGE = {
    MIN: 0,
    MAX: 50
  };
  
  // Salary Range
  const SALARY_RANGE = {
    MIN: 0,
    MAX: 10000000 // 10 million
  };
  
  // Notice Period (in days)
  const NOTICE_PERIOD = {
    MIN: 0,
    MAX: 365
  };
  
  // Password Requirements
  const PASSWORD_REQUIREMENTS = {
    MIN_LENGTH: 8,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL_CHAR: true,
    REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
  };
  
  // JWT Configuration
  const JWT_CONFIG = {
    ACCESS_TOKEN_EXPIRY: '7d',
    REFRESH_TOKEN_EXPIRY: '30d',
    RESET_TOKEN_EXPIRY: '1h'
  };
  
  // Email Templates
  const EMAIL_TEMPLATES = {
    WELCOME: 'welcome',
    PASSWORD_RESET: 'password_reset',
    INVITE: 'invite',
    SUBMISSION_UPDATE: 'submission_update',
    REQUIREMENT_ASSIGNED: 'requirement_assigned',
    MILESTONE_ACHIEVED: 'milestone_achieved'
  };
  
  // Notification Types
  const NOTIFICATION_TYPES = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error'
  };
  
  // Activity Types
  const ACTIVITY_TYPES = {
    USER_CREATED: 'user_created',
    USER_UPDATED: 'user_updated',
    USER_DEACTIVATED: 'user_deactivated',
    REQUIREMENT_CREATED: 'requirement_created',
    REQUIREMENT_UPDATED: 'requirement_updated',
    REQUIREMENT_CLOSED: 'requirement_closed',
    SUBMISSION_CREATED: 'submission_created',
    SUBMISSION_STATUS_UPDATED: 'submission_status_updated',
    AI_ANALYSIS_COMPLETED: 'ai_analysis_completed',
    TRUST_POINTS_AWARDED: 'trust_points_awarded',
    MILESTONE_ACHIEVED: 'milestone_achieved'
  };
  
  // System Settings
  const SYSTEM_SETTINGS = {
    APP_NAME: 'RecruitPro',
    APP_VERSION: '1.0.0',
    SUPPORT_EMAIL: 'support@recruitpro.com',
    MAX_FAILED_LOGIN_ATTEMPTS: 5,
    ACCOUNT_LOCKOUT_DURATION: 30 * 60 * 1000, // 30 minutes
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
    AI_ANALYSIS_TIMEOUT: 60 * 1000, // 60 seconds
    FILE_CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
    BACKUP_INTERVAL: 7 * 24 * 60 * 60 * 1000 // 7 days
  };
  
  // Error Codes
  const ERROR_CODES = {
    // Authentication & Authorization
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    INVALID_TOKEN: 'INVALID_TOKEN',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
    ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
    
    // Validation
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    INVALID_FORMAT: 'INVALID_FORMAT',
    DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
    
    // Resource Errors
    NOT_FOUND: 'NOT_FOUND',
    ALREADY_EXISTS: 'ALREADY_EXISTS',
    RESOURCE_LIMIT_EXCEEDED: 'RESOURCE_LIMIT_EXCEEDED',
    
    // File Upload Errors
    FILE_TOO_LARGE: 'FILE_TOO_LARGE',
    INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
    FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
    
    // AI Service Errors
    AI_SERVICE_UNAVAILABLE: 'AI_SERVICE_UNAVAILABLE',
    AI_ANALYSIS_FAILED: 'AI_ANALYSIS_FAILED',
    LINKEDIN_PARSING_FAILED: 'LINKEDIN_PARSING_FAILED',
    RESUME_PARSING_FAILED: 'RESUME_PARSING_FAILED',
    
    // Business Logic Errors
    INSUFFICIENT_TRUST_POINTS: 'INSUFFICIENT_TRUST_POINTS',
    REQUIREMENT_INACTIVE: 'REQUIREMENT_INACTIVE',
    SUBMISSION_DEADLINE_PASSED: 'SUBMISSION_DEADLINE_PASSED',
    MAX_SUBMISSIONS_REACHED: 'MAX_SUBMISSIONS_REACHED',
    
    // System Errors
    INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
  };
  
  // Success Messages
  const SUCCESS_MESSAGES = {
    USER_CREATED: 'User created successfully',
    USER_UPDATED: 'User updated successfully',
    USER_DELETED: 'User deleted successfully',
    LOGIN_SUCCESS: 'Login successful',
    LOGOUT_SUCCESS: 'Logout successful',
    PASSWORD_CHANGED: 'Password changed successfully',
    REQUIREMENT_CREATED: 'Requirement created successfully',
    REQUIREMENT_UPDATED: 'Requirement updated successfully',
    SUBMISSION_CREATED: 'Candidate submitted successfully',
    SUBMISSION_UPDATED: 'Submission updated successfully',
    AI_ANALYSIS_COMPLETED: 'AI analysis completed successfully',
    FILE_UPLOADED: 'File uploaded successfully',
    EMAIL_SENT: 'Email sent successfully'
  };
  
  // Database Collections
  const DB_COLLECTIONS = {
    USERS: 'users',
    CLIENTS: 'clients',
    REQUIREMENTS: 'requirements',
    SUBMISSIONS: 'submissions',
    MATCH_SCORES: 'matchscores',
    ACTIVITY_LOGS: 'activitylogs',  
    NOTIFICATIONS: 'notifications',
    SYSTEM_SETTINGS: 'systemsettings'
  };
  
  // LinkedIn Profile URL Regex
  const LINKEDIN_URL_REGEX = /^https?:\/\/(www\.)?linkedin\.com\/(in|pub)\/[\w\-_À-ÿ%]+\/?$/;
  
  // Email Regex
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  // Phone Number Regex (International format)
  const PHONE_REGEX = /^[\+]?[1-9][\d]{0,15}$/;
  
  // Export Time Periods
  const TIME_PERIODS = {
    WEEK: 'week',
    MONTH: 'month',
    QUARTER: 'quarter',
    YEAR: 'year'
  };
  
  // Export Formats
  const EXPORT_FORMATS = {
    CSV: 'csv',
    EXCEL: 'excel',
    PDF: 'pdf',
    JSON: 'json'
  };
  
  // Sort Orders
  const SORT_ORDERS = {
    ASC: 'asc',
    DESC: 'desc'
  };
  
  // Default Sort Fields
  const DEFAULT_SORT_FIELDS = {
    USERS: 'createdAt',
    REQUIREMENTS: 'createdAt',
    SUBMISSIONS: 'createdAt',
    MATCH_SCORES: 'overallScore'
  };
  
  // Environment Types
  const ENVIRONMENTS = {
    DEVELOPMENT: 'development',
    STAGING: 'staging',
    PRODUCTION: 'production',
    TEST: 'test'
  };
  
  // Cache TTL (Time To Live) in seconds
  const CACHE_TTL = {
    SHORT: 300,    // 5 minutes
    MEDIUM: 1800,  // 30 minutes
    LONG: 3600,    // 1 hour
    VERY_LONG: 86400 // 24 hours
  };
  
  // API Response Status
  const API_STATUS = {
    SUCCESS: 'success',
    ERROR: 'error',
    PENDING: 'pending'
  };
  
  // Default Timezone
  const DEFAULT_TIMEZONE = 'UTC';
  
  // Date Formats
  const DATE_FORMATS = {
    ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
    DISPLAY: 'MMM DD, YYYY',
    DISPLAY_WITH_TIME: 'MMM DD, YYYY HH:mm A',
    API: 'YYYY-MM-DD',
    TIMESTAMP: 'YYYY-MM-DD HH:mm:ss'
  };
  
  module.exports = {
    USER_ROLES,
    USER_STATUS,
    SUBMISSION_STATUS,
    REQUIREMENT_STATUS,
    REQUIREMENT_PRIORITY,
    TRUST_POINTS,
    AI_MATCH_THRESHOLDS,
    FILE_LIMITS,
    RATE_LIMITS,
    PAGINATION,
    INTERVIEW_TYPES,
    FEEDBACK_CATEGORIES,
    CURRENCIES,
    EXPERIENCE_RANGE,
    SALARY_RANGE,
    NOTICE_PERIOD,
    PASSWORD_REQUIREMENTS,
    JWT_CONFIG,
    EMAIL_TEMPLATES,
    NOTIFICATION_TYPES,
    ACTIVITY_TYPES,
    SYSTEM_SETTINGS,
    ERROR_CODES,
    SUCCESS_MESSAGES,
    DB_COLLECTIONS,
    LINKEDIN_URL_REGEX,
    EMAIL_REGEX,
    PHONE_REGEX,
    TIME_PERIODS,
    EXPORT_FORMATS,
    SORT_ORDERS,
    DEFAULT_SORT_FIELDS,
    ENVIRONMENTS,
    CACHE_TTL,
    API_STATUS,
    DEFAULT_TIMEZONE,
    DATE_FORMATS
  };