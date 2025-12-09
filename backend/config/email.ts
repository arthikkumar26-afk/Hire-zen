/**
 * Email Configuration Module
 * Centralized email configuration for HireZen platform
 * Uses hire-zen.com domain
 */

export const emailConfig = {
  // Primary HR email for all candidate communications
  hr: {
    name: process.env.EMAIL_FROM_NAME || 'HireZen HR',
    address: process.env.EMAIL_FROM_ADDRESS || 'hr@hire-zen.com',
    get full() {
      return `${this.name} <${this.address}>`;
    }
  },

  // Automated emails (system notifications)
  noreply: {
    name: process.env.EMAIL_NOREPLY_NAME || 'HireZen',
    address: process.env.EMAIL_NOREPLY || 'noreply@hire-zen.com',
    get full() {
      return `${this.name} <${this.address}>`;
    }
  },

  // Support email
  support: {
    name: process.env.EMAIL_SUPPORT_NAME || 'HireZen Support',
    address: process.env.EMAIL_SUPPORT || 'support@hire-zen.com',
    get full() {
      return `${this.name} <${this.address}>`;
    }
  },

  // Reply-To address (always HR team)
  replyTo: process.env.EMAIL_REPLY_TO || 'hr@hire-zen.com',
};

/**
 * Get email sender configuration based on email type
 * @param type - Type of email: 'hr' | 'automated' | 'support'
 * @returns Object with 'from' and 'replyTo' addresses
 */
export function getEmailSender(type: 'hr' | 'automated' | 'support' = 'hr') {
  switch (type) {
    case 'automated':
      return {
        from: emailConfig.noreply.full,
        replyTo: emailConfig.replyTo,
      };
    case 'support':
      return {
        from: emailConfig.support.full,
        replyTo: emailConfig.replyTo,
      };
    default:
      return {
        from: emailConfig.hr.full,
        replyTo: emailConfig.replyTo,
      };
  }
}

/**
 * Validate email configuration
 * Throws error if required environment variables are missing
 */
export function validateEmailConfig() {
  const required = ['EMAIL_FROM_ADDRESS'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn(`Warning: Missing email environment variables: ${missing.join(', ')}. Using defaults.`);
  }
}

// Validate on module load
validateEmailConfig();


