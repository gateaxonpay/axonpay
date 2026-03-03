import Decimal from 'decimal.js';

export type TransactionType = 'deposit' | 'withdraw';
export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'busy' | 'failed';

export interface Profile {
    id: string;
    email: string | null;
    pix_key: string | null;
    pix_type: string | null;
    balance: string | number | Decimal;
    tax_rate: number; // 0.30 for standard, 0.25 for premium
    withdraw_lock_until: string | null;
    created_at: string;
}

export interface Transaction {
    id: string;
    user_id: string;
    external_id: string | null;
    type: TransactionType;
    amount_original: string | number | Decimal;
    amount_net: string | number | Decimal;
    description: string;
    status: TransactionStatus;
    is_final: boolean;
    pix_copia_e_cola: string | null;
    qr_code_url: string | null;
    created_at: string;
    updated_at: string;
    user_email?: string;
    user_name?: string;
}

export type Database = {
    public: {
        Tables: {
            profiles: {
                Row: Profile;
                Insert: Partial<Omit<Profile, 'created_at'>>;
                Update: Partial<Profile>;
            };
            transactions: {
                Row: Transaction;
                Insert: Partial<Omit<Transaction, 'created_at' | 'updated_at'>>;
                Update: Partial<Transaction>;
            };
        };
    };
};
