import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { Role, RoleName } from '../models/role.model.js';
import { User } from '../models/user.model.js';
import { Category, CategoryType } from '../models/category.model.js';

export const SYSTEM_ROLES = [
  {
    name: RoleName.SUPER_ADMIN,
    description: 'Complete platform administration, user management, and system health oversight.',
    permissions: ['*'],
    isSystem: true,
  },
  {
    name: RoleName.COMPLIANCE_OFFICER,
    description: 'Read-only compliance officer with access to security audits and activity logs.',
    permissions: ['audit:read', 'users:read', 'reports:read'],
    isSystem: true,
  },
  {
    name: RoleName.FINANCIAL_ANALYST,
    description:
      'Financial intelligence analyst with access to anonymized market trends and ML metrics.',
    permissions: ['market:read', 'ml:read', 'analytics:read'],
    isSystem: true,
  },
  {
    name: RoleName.PREMIUM_USER,
    description: 'Power user with advanced ML price forecasting and unlimited stock watchlists.',
    permissions: ['finance:all', 'investments:all', 'ml:forecast:all', 'watchlists:unlimited'],
    isSystem: true,
  },
  {
    name: RoleName.USER,
    description:
      'Standard personal finance user with personal budgets, tracking, and basic market data.',
    permissions: ['finance:all', 'investments:read', 'watchlists:basic'],
    isSystem: true,
  },
];

export const SYSTEM_CATEGORIES = [
  // Income Categories
  {
    name: 'Salary & Wages',
    slug: 'salary-wages',
    type: CategoryType.INCOME,
    icon: 'banknote',
    color: '#10B981',
  },
  {
    name: 'Investment Income',
    slug: 'investment-income',
    type: CategoryType.INCOME,
    icon: 'trending-up',
    color: '#059669',
  },
  {
    name: 'Freelance & Consulting',
    slug: 'freelance-consulting',
    type: CategoryType.INCOME,
    icon: 'briefcase',
    color: '#34D399',
  },
  {
    name: 'Dividends',
    slug: 'dividends',
    type: CategoryType.INCOME,
    icon: 'dollar-sign',
    color: '#6EE7B7',
  },
  {
    name: 'Other Income',
    slug: 'other-income',
    type: CategoryType.INCOME,
    icon: 'plus-circle',
    color: '#A7F3D0',
  },

  // Expense Categories
  {
    name: 'Housing & Rent',
    slug: 'housing-rent',
    type: CategoryType.EXPENSE,
    icon: 'home',
    color: '#EF4444',
  },
  {
    name: 'Groceries',
    slug: 'groceries',
    type: CategoryType.EXPENSE,
    icon: 'shopping-cart',
    color: '#F59E0B',
  },
  {
    name: 'Dining & Restaurants',
    slug: 'dining-restaurants',
    type: CategoryType.EXPENSE,
    icon: 'utensils',
    color: '#F97316',
  },
  {
    name: 'Transportation & Fuel',
    slug: 'transportation-fuel',
    type: CategoryType.EXPENSE,
    icon: 'car',
    color: '#6366F1',
  },
  {
    name: 'Utilities & Bills',
    slug: 'utilities-bills',
    type: CategoryType.EXPENSE,
    icon: 'zap',
    color: '#8B5CF6',
  },
  {
    name: 'Entertainment & Leisure',
    slug: 'entertainment-leisure',
    type: CategoryType.EXPENSE,
    icon: 'film',
    color: '#EC4899',
  },
  {
    name: 'Healthcare & Medical',
    slug: 'healthcare-medical',
    type: CategoryType.EXPENSE,
    icon: 'heart',
    color: '#14B8A6',
  },
  {
    name: 'Shopping & Retail',
    slug: 'shopping-retail',
    type: CategoryType.EXPENSE,
    icon: 'shopping-bag',
    color: '#3B82F6',
  },
  {
    name: 'Travel & Vacation',
    slug: 'travel-vacation',
    type: CategoryType.EXPENSE,
    icon: 'plane',
    color: '#0EA5E9',
  },
  {
    name: 'Education & Learning',
    slug: 'education-learning',
    type: CategoryType.EXPENSE,
    icon: 'book-open',
    color: '#84CC16',
  },
  {
    name: 'Financial & Bank Fees',
    slug: 'financial-fees',
    type: CategoryType.EXPENSE,
    icon: 'alert-circle',
    color: '#64748B',
  },
  {
    name: 'Subscriptions & Software',
    slug: 'subscriptions-software',
    type: CategoryType.EXPENSE,
    icon: 'repeat',
    color: '#A855F7',
  },

  // Transfer Categories
  {
    name: 'Account Transfer',
    slug: 'account-transfer',
    type: CategoryType.TRANSFER,
    icon: 'arrow-right-left',
    color: '#6B7280',
  },
  {
    name: 'Credit Card Payment',
    slug: 'credit-card-payment',
    type: CategoryType.TRANSFER,
    icon: 'credit-card',
    color: '#4B5563',
  },
  {
    name: 'Investment Transfer',
    slug: 'investment-transfer',
    type: CategoryType.TRANSFER,
    icon: 'layers',
    color: '#374151',
  },
];

export async function runSeeds(): Promise<void> {
  logger.info('🌱 Starting database seed script...');

  try {
    await connectDatabase();

    // 1. Seed Roles
    logger.info('Checking system roles...');
    for (const roleData of SYSTEM_ROLES) {
      const existingRole = await Role.findOne({ name: roleData.name });
      if (!existingRole) {
        await Role.create(roleData);
        logger.info(`Created system role: ${roleData.name}`);
      }
    }

    // 2. Seed Standard System Categories
    logger.info('Checking default system categories...');
    let categoriesCreated = 0;
    for (const catData of SYSTEM_CATEGORIES) {
      const existingCat = await Category.findOne({ slug: catData.slug, isSystem: true });
      if (!existingCat) {
        await Category.create({
          ...catData,
          isSystem: true,
        });
        categoriesCreated++;
      }
    }
    logger.info(`System categories verified. (${categoriesCreated} newly created)`);

    // 3. Seed Development Admin Account (Only if safe)
    if (env.NODE_ENV === 'production') {
      logger.info('⚠️ Production environment detected. Skipping development admin account seed.');
    } else {
      const devAdminEmail = 'admin@smartfin.ai';
      const existingAdmin = await User.findOne({ email: devAdminEmail });

      if (!existingAdmin) {
        const superAdminRole = await Role.findOne({ name: RoleName.SUPER_ADMIN });

        await User.create({
          email: devAdminEmail,
          passwordHash: 'Admin@SmartFin2026!', // Will be auto-hashed by userSchema pre('save') hook
          firstName: 'System',
          lastName: 'Administrator',
          role: RoleName.SUPER_ADMIN,
          roleId: superAdminRole?._id,
          isEmailVerified: true,
          defaultCurrency: 'USD',
          locale: 'en-US',
          preferences: {
            theme: 'dark',
            emailAlerts: true,
            pushAlerts: true,
            weeklyDigest: true,
          },
        });

        logger.info(`✅ Development admin account created:`);
        logger.info(`   Email:    ${devAdminEmail}`);
        logger.info(`   Password: Admin@SmartFin2026!`);
      } else {
        logger.info(`Development admin account already exists (${devAdminEmail}).`);
      }
    }

    logger.info('🌱 Database seeding completed successfully.');
  } catch (error) {
    logger.error({ error }, 'Database seeding encountered a fatal error');
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

// Execute directly if run as a script
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  runSeeds().then(() => {
    process.exit(process.exitCode || 0);
  });
}
