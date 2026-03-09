import React from 'react';
import { useCurrency } from '../contexts/CurrencyContext';
import { DollarSign, IndianRupee, Euro, PoundSterling, Coins } from 'lucide-react';

// Currency Icon Component - dynamically shows the correct icon based on selected currency
export function CurrencyIcon({ className = "w-5 h-5", currency: overrideCurrency }) {
  const { displayCurrency } = useCurrency();
  const currencyCode = overrideCurrency || displayCurrency;
  
  const iconProps = { className };
  
  switch (currencyCode) {
    case 'INR':
      return <IndianRupee {...iconProps} />;
    case 'USD':
    case 'SGD':
    case 'AUD':
    case 'CAD':
      return <DollarSign {...iconProps} />;
    case 'EUR':
      return <Euro {...iconProps} />;
    case 'GBP':
      return <PoundSterling {...iconProps} />;
    case 'JPY':
    case 'CNY':
      return <span className={className} style={{ fontFamily: 'system-ui', fontWeight: 500 }}>¥</span>;
    case 'AED':
      return <span className={className} style={{ fontFamily: 'system-ui', fontWeight: 500 }}>د.إ</span>;
    case 'SAR':
      return <span className={className} style={{ fontFamily: 'system-ui', fontWeight: 500 }}>﷼</span>;
    case 'MYR':
      return <span className={className} style={{ fontFamily: 'system-ui', fontWeight: 500 }}>RM</span>;
    case 'THB':
      return <span className={className} style={{ fontFamily: 'system-ui', fontWeight: 500 }}>฿</span>;
    case 'NPR':
    case 'PKR':
      return <span className={className} style={{ fontFamily: 'system-ui', fontWeight: 500 }}>₨</span>;
    case 'BDT':
      return <span className={className} style={{ fontFamily: 'system-ui', fontWeight: 500 }}>৳</span>;
    case 'LKR':
      return <span className={className} style={{ fontFamily: 'system-ui', fontWeight: 500 }}>Rs</span>;
    default:
      return <Coins {...iconProps} />;
  }
}

export default CurrencyIcon;
