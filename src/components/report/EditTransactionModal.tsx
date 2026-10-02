import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import TransactionForm from '../TransactionForm';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
  onChangeTransaction?: (transaction: any) => void;
  onSubmit: (e: React.FormEvent, updatedData?: any) => void;
  employees: string[];
  branches: string[];
  categories: string[];
  isUpdating: boolean;
}

/**
 * EditTransactionModal
 * Fully unified modal that renders the exact same authoritative TransactionForm
 * with identical fields, validation, and design to provide seamless editing.
 */
export default function EditTransactionModal({
  isOpen,
  onClose,
  transaction,
  onSubmit,
  employees,
  branches,
  categories,
  isUpdating
}: EditTransactionModalProps) {
  if (!isOpen || !transaction) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md no-print overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-3xl my-auto"
        >
          <TransactionForm
            mode="edit"
            transaction={transaction}
            employees={employees}
            branches={branches}
            categories={categories}
            isUpdating={isUpdating}
            onCancel={onClose}
            onComplete={(updatedData) => {
              onSubmit({ preventDefault: () => {} } as any, updatedData);
            }}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
