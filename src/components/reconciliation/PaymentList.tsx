'use client';

import type { PaymentData } from './types';

interface PaymentListProps {
  payments?: PaymentData[];
}

// Placeholder component for future payment list functionality
export default function PaymentList({ payments = [] }: PaymentListProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
        Payment List Component
      </h3>
      
      {payments.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <span className="text-xl">💳</span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            No payment data uploaded yet
          </p>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Coming in Story 1.11: Payment data display and management
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map((payment, index) => (
            <div key={payment.transactionFingerprint || index} 
                 className="p-3 border border-gray-200 dark:border-gray-600 rounded">
              <div className="flex justify-between items-center">
                <span className="font-medium">{payment.description}</span>
                <span className="text-green-600">£{payment.amount.toFixed(2)}</span>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {payment.paymentDate.toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}