const mongoose = require('mongoose');

/**
 * Database Configuration for SaaS Recruitment Platform
 * Supports MongoDB with connection pooling, retry logic, and environment-based configuration
 */

class DatabaseConfig {
  constructor() {
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 seconds
    
    // Database configuration options
    this.mongooseOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      bufferCommands: false, // Disable mongoose buffering
      bufferMaxEntries: 0, // Disable mongoose buffering
      maxIdleTimeMS: 50000, // Close connections after 50 seconds of inactivity
      maxStalenessSeconds: 30, // For read operations
    };
  }

  /**
   * Get MongoDB connection URI based on environment
   */
  getConnectionURI() {
    const {
      NODE_ENV,
      MONGODB_URI,
      MONGODB_HOST,
      MONGODB_PORT,
      MONGODB_DATABASE,
      MONGODB_USERNAME,
      MONGODB_PASSWORD,
      MONGODB_AUTH_SOURCE,
      MONGODB_REPLICA_SET
    } = process.env;

    // Use full URI if provided (for production/cloud deployments)
    if (MONGODB_URI) {
      return MONGODB_URI;
    }

    // Build URI from individual components (for development/custom setups)
    const host = MONGODB_HOST || 'localhost';
    const port = MONGODB_PORT || '27017';
    const database = MONGODB_DATABASE || 'recruitment-platform';
    const authSource = MONGODB_AUTH_SOURCE || 'admin';

    let uri = 'mongodb://';

    // Add authentication if provided
    if (MONGODB_USERNAME && MONGODB_PASSWORD) {
      uri += `${encodeURIComponent(MONGODB_USERNAME)}:${encodeURIComponent(MONGODB_PASSWORD)}@`;
    }

    uri += `${host}:${port}/${database}`;

    // Add query parameters
    const queryParams = [];
    if (MONGODB_USERNAME && MONGODB_PASSWORD) {
      queryParams.push(`authSource=${authSource}`);
    }
    if (MONGODB_REPLICA_SET) {
      queryParams.push(`replicaSet=${MONGODB_REPLICA_SET}`);
    }

    if (queryParams.length > 0) {
      uri += `?${queryParams.join('&')}`;
    }

    return uri;
  }

  /**
   * Connect to MongoDB with retry logic
   */
  async connect() {
    const uri = this.getConnectionURI();
    
    console.log(`🔄 Attempting to connect to MongoDB... (Attempt ${this.connectionAttempts + 1}/${this.maxRetries})`);
    
    try {
      await mongoose.connect(uri, this.mongooseOptions);
      
      this.isConnected = true;
      this.connectionAttempts = 0;
      
      console.log('✅ Successfully connected to MongoDB');
      console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
      console.log(`🔗 Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
      
      this.setupEventListeners();
      return mongoose.connection;
      
    } catch (error) {
      this.connectionAttempts++;
      console.error(`❌ MongoDB connection failed (Attempt ${this.connectionAttempts}):`, {
        message: error.message,
        code: error.code,
        name: error.name
      });

      if (this.connectionAttempts < this.maxRetries) {
        console.log(`⏳ Retrying connection in ${this.retryDelay / 1000} seconds...`);
        await this.delay(this.retryDelay);
        return this.connect();
      } else {
        console.error(`💥 Failed to connect to MongoDB after ${this.maxRetries} attempts`);
        throw new Error(`Database connection failed after ${this.maxRetries} attempts: ${error.message}`);
      }
    }
  }

  /**
   * Setup event listeners for database connection
   */
  setupEventListeners() {
    const db = mongoose.connection;

    db.on('connected', () => {
      console.log('🔗 Mongoose connected to MongoDB');
      this.isConnected = true;
    });

    db.on('error', (error) => {
      console.error('❌ MongoDB connection error:', error);
      this.isConnected = false;
    });

    db.on('disconnected', () => {
      console.log('🔌 Mongoose disconnected from MongoDB');
      this.isConnected = false;
    });

    db.on('reconnected', () => {
      console.log('🔄 Mongoose reconnected to MongoDB');
      this.isConnected = true;
    });

    // Handle application termination
    process.on('SIGINT', this.gracefulShutdown.bind(this));
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('SIGUSR2', this.gracefulShutdown.bind(this)); // For nodemon restarts
  }

  /**
   * Graceful shutdown of database connection
   */
  async gracefulShutdown(signal) {
    console.log(`\n🛑 Received ${signal}. Gracefully shutting down database connection...`);
    
    try {
      await mongoose.connection.close();
      console.log('✅ MongoDB connection closed successfully');
      this.isConnected = false;
      
      if (signal === 'SIGUSR2') {
        // For nodemon, kill the process to allow restart
        process.kill(process.pid, 'SIGUSR2');
      } else {
        process.exit(0);
      }
    } catch (error) {
      console.error('❌ Error during database shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Check if database is connected
   */
  isHealthy() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * Get database connection status
   */
  getStatus() {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      status: states[mongoose.connection.readyState] || 'unknown',
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      database: mongoose.connection.db?.databaseName,
      collections: mongoose.connection.db ? Object.keys(mongoose.connection.collections) : []
    };
  }

  /**
   * Initialize database with indexes and constraints
   */
  async initializeDatabase() {
    if (!this.isHealthy()) {
      throw new Error('Database connection is not healthy');
    }

    console.log('🔧 Initializing database indexes and constraints...');

    try {
      // Create indexes for better performance
      const db = mongoose.connection.db;

      // Users collection indexes
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      await db.collection('users').createIndex({ role: 1 });
      await db.collection('users').createIndex({ isActive: 1 });
      await db.collection('users').createIndex({ clientId: 1 });

      // Requirements collection indexes
      await db.collection('requirements').createIndex({ clientId: 1 });
      await db.collection('requirements').createIndex({ status: 1 });
      await db.collection('requirements').createIndex({ deadline: 1 });
      await db.collection('requirements').createIndex({ assignedRecruiters: 1 });
      await db.collection('requirements').createIndex({ createdAt: -1 });

      // Submissions collection indexes
      await db.collection('submissions').createIndex({ requirementId: 1 });
      await db.collection('submissions').createIndex({ recruiterId: 1 });
      await db.collection('submissions').createIndex({ currentStatus: 1 });
      await db.collection('submissions').createIndex({ candidateEmail: 1 });
      await db.collection('submissions').createIndex({ createdAt: -1 });
      await db.collection('submissions').createIndex(
        { requirementId: 1, recruiterId: 1, candidateEmail: 1 }, 
        { unique: true }
      );

      // Match scores collection indexes
      await db.collection('matchscores').createIndex({ submissionId: 1 }, { unique: true });
      await db.collection('matchscores').createIndex({ overallScore: -1 });
      await db.collection('matchscores').createIndex({ createdAt: -1 });

      console.log('✅ Database indexes created successfully');

      // Create default system admin if not exists
      await this.createDefaultSystemAdmin();

    } catch (error) {
      console.error('❌ Error initializing database:', error);
      throw error;
    }
  }

  /**
   * Create default system administrator
   */
  async createDefaultSystemAdmin() {
    try {
      const User = require('../models/User');
      
      const existingAdmin = await User.findOne({ role: 'system_admin' });
      if (existingAdmin) {
        console.log('✅ System administrator already exists');
        return;
      }

      const defaultAdmin = new User({
        email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@recruitment-platform.com',
        password: process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123456',
        firstName: 'System',
        lastName: 'Administrator',
        role: 'system_admin',
        isActive: true,
        profile: {
          company: 'Recruitment Platform',
          phone: '+1-000-000-0000'
        }
      });

      await defaultAdmin.save();
      console.log('✅ Default system administrator created');
      console.log(`📧 Email: ${defaultAdmin.email}`);
      console.log('🔑 Password: Please change the default password after first login');

    } catch (error) {
      console.error('❌ Error creating default system admin:', error);
    }
  }

  /**
   * Utility method for delays
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up database collections (for testing)
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production environment');
    }

    const collections = await mongoose.connection.db.collections();
    
    for (let collection of collections) {
      await collection.deleteMany({});
    }
    
    console.log('🧹 Database cleaned successfully');
  }

  /**
   * Get database statistics
   */
  async getStats() {
    if (!this.isHealthy()) {
      return { error: 'Database not connected' };
    }

    try {
      const db = mongoose.connection.db;
      const stats = await db.stats();
      
      return {
        database: stats.db,
        collections: stats.collections,
        documents: stats.objects,
        avgObjSize: stats.avgObjSize,
        dataSize: this.formatBytes(stats.dataSize),
        storageSize: this.formatBytes(stats.storageSize),
        indexSize: this.formatBytes(stats.indexSize),
        totalSize: this.formatBytes(stats.dataSize + stats.indexSize)
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Create and export singleton instance
const databaseConfig = new DatabaseConfig();

module.exports = {
  connect: () => databaseConfig.connect(),
  disconnect: () => mongoose.connection.close(),
  isHealthy: () => databaseConfig.isHealthy(),
  getStatus: () => databaseConfig.getStatus(),
  initializeDatabase: () => databaseConfig.initializeDatabase(),
  cleanDatabase: () => databaseConfig.cleanDatabase(),
  getStats: () => databaseConfig.getStats(),
  connection: mongoose.connection
};