import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase 환경 변수가 설정되지 않았습니다. .env.local을 확인하세요.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface SalesRecord {
  id?: number;
  월: string;
  지점: string;
  매출액: number;
  객수: number;
  비고?: string | null;
  created_at?: string;
}
