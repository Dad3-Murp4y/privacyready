import { useOutletContext } from 'react-router-dom';

export type PortalContextValue = {
  isPremium: boolean;
  subscriptionLoading: boolean;
  subscriptionError: string;
  startCheckout: (plan?: 'starter' | 'growth') => Promise<void>;
  invalidatePremium: () => void;
};

export function usePortal() { return useOutletContext<PortalContextValue>(); }
