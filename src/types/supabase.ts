export type Profile = {
    id: string;
    email: string | null;
    pix_key: string | null;
    balance: number;
    created_at: string;
};

export type Transaction = {
    id: string;
    user_id: string;
    external_id: string | null;
    type: 'deposit' | 'withdraw';
    amount_original: number;
    amount_net: number;
    description: string;
    status: 'pending' | 'processing' | 'completed' | 'cancelled';
    is_final: boolean;
    pix_copia_e_cola: string | null;
    qr_code_url: string | null;
    created_at: string;
    updated_at: string;
};

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: Profile;
                Insert: Partial<Profile>;
                Update: Partial<Profile>;
            };
            transactions: {
                Row: Transaction;
                Insert: Partial<Transaction>;
                Update: Partial<Transaction>;
            };
        };
    };
}
