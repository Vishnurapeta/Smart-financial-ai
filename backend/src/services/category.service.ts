import { Types } from 'mongoose';
import { Category, ICategory, CategoryType } from '../models/category.model.js';
import { SYSTEM_CATEGORIES } from '../seeds/seed.js';

export class CategoryService {
  /**
   * Get all active categories available to the user (system + user-defined)
   */
  static async getCategories(userId?: string): Promise<ICategory[]> {
    const filter = {
      isDeleted: false,
      $or: [
        { isSystem: true },
        { userId: null },
        ...(userId && Types.ObjectId.isValid(userId)
          ? [{ userId: new Types.ObjectId(userId) }]
          : []),
      ],
    };

    let categories = await Category.find(filter).sort({ type: 1, name: 1 });

    // Auto-seed default system categories if collection is empty
    if (categories.length === 0) {
      const docs = SYSTEM_CATEGORIES.map((cat) => ({
        ...cat,
        userId: null,
        isSystem: true,
      }));
      await Category.insertMany(docs);
      categories = await Category.find(filter).sort({ type: 1, name: 1 });
    }

    return categories;
  }

  /**
   * Create custom category for user
   */
  static async createCategory(
    userId: string,
    input: { name: string; type: CategoryType; icon?: string; color?: string },
  ): Promise<ICategory> {
    const slug = (typeof input.name === 'string' ? input.name : '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const category = await Category.create({
      ...input,
      slug,
      userId: new Types.ObjectId(userId),
      isSystem: false,
    });
    return category;
  }
}
