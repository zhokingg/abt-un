import { EventEmitter } from 'events';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

/**
 * Enterprise Security Manager
 * Provides comprehensive security features including encryption, access control, and audit logging
 */
export class SecurityManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      encryptionAlgorithm: options.encryptionAlgorithm || 'aes-256-gcm',
      encryptionKey: options.encryptionKey || process.env.ENCRYPTION_KEY,
      keyDerivationIterations: options.keyDerivationIterations || 100000,
      accessControlEnabled: options.accessControlEnabled !== false,
      auditLoggingEnabled: options.auditLoggingEnabled !== false,
      sessionTimeout: options.sessionTimeout || 3600000, // 1 hour
      maxFailedAttempts: options.maxFailedAttempts || 5,
      lockoutDuration: options.lockoutDuration || 900000, // 15 minutes
      enableHardwareWallet: options.enableHardwareWallet || false,
      ...options
    };
    
    this.initialized = false;
    this.accessControl = new Map();
    this.sessions = new Map();
    this.failedAttempts = new Map();
    this.lockedAccounts = new Map();
    this.auditLog = [];
    this.encryptionCache = new Map();
    
    // Security incident tracking
    this.securityIncidents = [];
    this.threatLevel = 'normal'; // normal, elevated, high, critical
    this.anomalyDetection = {
      enabled: true,
      thresholds: {
        loginFailures: 10,
        apiRequests: 1000,
        dataAccess: 100
      }
    };
  }

  /**
   * Initialize security manager
   */
  async initialize() {
    try {
      console.log('🔐 Initializing Security Manager...');
      
      // Generate or load encryption key
      await this.initializeEncryption();
      
      // Setup access control
      await this.initializeAccessControl();
      
      // Initialize audit logging
      await this.initializeAuditLogging();
      
      // Setup hardware wallet if enabled
      if (this.options.enableHardwareWallet) {
        await this.initializeHardwareWallet();
      }
      
      // Start security monitoring
      this.startSecurityMonitoring();
      
      this.initialized = true;
      console.log('✅ Security Manager initialized successfully');
      
      this.emit('initialized', {
        encryptionEnabled: !!this.options.encryptionKey,
        accessControlEnabled: this.options.accessControlEnabled,
        auditLoggingEnabled: this.options.auditLoggingEnabled,
        hardwareWalletEnabled: this.options.enableHardwareWallet
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize Security Manager:', error.message);
      throw error;
    }
  }

  /**
   * Initialize encryption system
   */
  async initializeEncryption() {
    if (!this.options.encryptionKey) {
      console.warn('⚠️ No encryption key provided, generating new key');
      this.options.encryptionKey = this.generateEncryptionKey();
      
      // In production, save this key securely
      if (process.env.NODE_ENV !== 'test') {
        console.log('🔑 New encryption key generated. Please store it securely:');
        console.log(`ENCRYPTION_KEY=${this.options.encryptionKey}`);
      }
    }
    
    // Validate encryption key
    if (this.options.encryptionKey.length < 64) {
      throw new Error('Encryption key must be at least 64 characters long');
    }
    
    console.log('🔐 Encryption system initialized');
  }

  /**
   * Initialize access control system
   */
  async initializeAccessControl() {
    if (!this.options.accessControlEnabled) {
      console.log('⚠️ Access control is disabled');
      return;
    }
    
    // Define default roles and permissions
    const defaultRoles = {
      admin: {
        permissions: [
          'system:read', 'system:write', 'system:admin',
          'trading:read', 'trading:write', 'trading:execute',
          'config:read', 'config:write', 'security:read', 'security:write'
        ],
        description: 'Full system access'
      },
      operator: {
        permissions: [
          'trading:read', 'trading:write', 'trading:execute',
          'system:read', 'config:read'
        ],
        description: 'Trading operations access'
      },
      viewer: {
        permissions: [
          'trading:read', 'system:read'
        ],
        description: 'Read-only access'
      }
    };
    
    // Initialize roles
    for (const [roleName, roleConfig] of Object.entries(defaultRoles)) {
      this.accessControl.set(`role:${roleName}`, roleConfig);
    }
    
    console.log('👮 Access control system initialized');
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(data, associatedData = null) {
    try {
      const key = Buffer.from(this.options.encryptionKey, 'hex');
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipher('aes-256-cbc', key);
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        algorithm: 'aes-256-cbc'
      };
    } catch (error) {
      this.logSecurityEvent('encryption_error', { error: error.message });
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData, associatedData = null) {
    try {
      const { encrypted, iv, algorithm } = encryptedData;
      const key = Buffer.from(this.options.encryptionKey, 'hex');
      
      const decipher = crypto.createDecipher(algorithm, key);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      this.logSecurityEvent('decryption_error', { error: error.message });
      throw new Error('Decryption failed');
    }
  }

  /**
   * Generate encryption key
   */
  generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Log security event
   */
  async logSecurityEvent(eventType, eventData) {
    const logEntry = {
      id: crypto.randomBytes(16).toString('hex'),
      eventType,
      timestamp: Date.now(),
      data: eventData
    };
    
    this.auditLog.push(logEntry);
    
    // Keep audit log size manageable
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
    
    this.emit('securityEvent', logEntry);
  }

  /**
   * Get security status
   */
  getSecurityStatus() {
    return {
      initialized: this.initialized,
      threatLevel: this.threatLevel,
      activeSessions: this.sessions.size,
      lockedAccounts: this.lockedAccounts.size,
      recentIncidents: this.securityIncidents.filter(
        incident => Date.now() - incident.timestamp < 3600000
      ).length,
      encryptionEnabled: !!this.options.encryptionKey,
      accessControlEnabled: this.options.accessControlEnabled,
      auditLoggingEnabled: this.options.auditLoggingEnabled
    };
  }
}

export default SecurityManager;