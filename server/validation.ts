import { z } from 'zod';

export const transactionSchema = z.object({
  employee: z.string().min(1, 'اسم الموظف أو صاحب العهدة مطلوب'),
  amount: z.union([z.number(), z.string()]).refine((val) => {
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, '').trim());
    return !isNaN(num) && num > 0;
  }, { message: 'المبلغ يجب أن يكون رقماً موجباً أكبر من الصفر' }),
  type: z.enum(['Income', 'Expense', 'Transfer', 'Transfer-In', 'Transfer-Out']).default('Expense'),
  branch: z.string().optional().default('الرئيسي'),
  category: z.string().optional().default('نثريات'),
  description: z.string().optional().default(''),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'التاريخ يجب أن يكون بصيغة YYYY-MM-DD').optional(),
  targetMonth: z.string().optional(),
  sender: z.string().optional(),
  receiver: z.string().optional()
});

export const employeeSchema = z.object({
  name: z.string().trim().min(2, 'اسم الموظف يجب أن يتكون من حرفين على الأقل')
});

export const orderItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'اسم الصنف مطلوب'),
  quantity: z.number().positive('الكمية يجب أن تكون أكبر من الصفر').default(1),
  unit: z.string().default('حبة'),
  unitPrice: z.number().nonnegative('سعر الوحدة لا يمكن أن يكون سالباً').default(0),
  totalPrice: z.number().nonnegative('الإجمالي لا يمكن أن يكون سالباً').default(0),
  notes: z.string().optional()
});

export const orderSchema = z.object({
  title: z.string().min(2, 'عنوان الطلبية مطلوب'),
  type: z.enum(['purchase', 'supply', 'customer', 'branch_transfer']).default('purchase'),
  supplierOrCustomer: z.string().min(1, 'اسم المورد أو العميل مطلوب'),
  branch: z.string().default('الرئيسي'),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  deliveryDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amount: z.number().nonnegative('مبلغ الطلبية لا يمكن أن يكون سالباً'),
  paidAmount: z.number().nonnegative('المبلغ المدفوع لا يمكن أن يكون سالباً').default(0),
  status: z.enum(['pending', 'in_progress', 'shipped', 'delivered', 'cancelled', 'delayed']).default('pending'),
  priority: z.enum(['urgent', 'high', 'normal', 'low']).default('normal'),
  paymentStatus: z.enum(['paid', 'partial', 'unpaid']).default('unpaid'),
  assignedEmployee: z.string().optional(),
  contactPhone: z.string().optional(),
  items: z.array(orderItemSchema).optional().default([]),
  notes: z.string().optional()
});

export const settingsSchema = z.object({
  branches: z.array(z.string().min(1)).optional(),
  categories: z.array(z.string().min(1)).optional()
});

export const reconciliationActionSchema = z.object({
  entityId: z.string().optional(),
  fixDiscrepancy: z.boolean().optional().default(false)
});
