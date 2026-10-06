"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase, type SalesRecord } from "@/lib/supabaseClient";
import {
  Store,
  Calendar,
  DollarSign,
  Users,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  RefreshCw,
  BarChart3,
} from "lucide-react";

const BRANCH_LIST = [
  "용산역점",
  "삼각지점",
  "이태원점",
  "효창공원점",
  "한남점",
] as const;

export default function SalesInputPage() {
  const [branch, setBranch] = useState<string>("용산역점");
  const [month, setMonth] = useState<string>("2026-09");
  const [salesAmount, setSalesAmount] = useState<string>("");
  const [customerCount, setCustomerCount] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const [isLoadingExisting, setIsLoadingExisting] = useState<boolean>(false);
  const [isExistingData, setIsExistingData] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    title: string;
    message: string;
    details?: {
      branch: string;
      month: string;
      sales: number;
      customers: number;
      note?: string | null;
    };
  } | null>(null);

  // 기존 등록 데이터 확인 및 폼 자동 채우기
  const checkExistingData = useCallback(async (targetBranch: string, targetMonth: string) => {
    if (!targetBranch || !targetMonth) return;

    setIsLoadingExisting(true);
    try {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .eq("지점", targetBranch)
        .eq("월", targetMonth)
        .maybeSingle();

      if (error) {
        console.error("기존 데이터 조회 실패:", error);
        return;
      }

      if (data) {
        const record = data as unknown as SalesRecord;
        setIsExistingData(true);
        setSalesAmount(record.매출액 != null ? String(record.매출액) : "");
        setCustomerCount(record.객수 != null ? String(record.객수) : "");
        setNote(record.비고 || "");
      } else {
        setIsExistingData(false);
        setSalesAmount("");
        setCustomerCount("");
        setNote("");
      }
    } catch (err) {
      console.error("데이터 조회 에러:", err);
    } finally {
      setIsLoadingExisting(false);
    }
  }, []);

  // 지점이나 대상 월이 변경될 때 기존 데이터 확인
  useEffect(() => {
    checkExistingData(branch, month);
  }, [branch, month, checkExistingData]);

  // 폼 제출 (저장 또는 업데이트)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);

    // 유효성 검사
    if (!branch) {
      setNotification({
        type: "error",
        title: "입력 오류",
        message: "지점명을 선택해 주세요.",
      });
      return;
    }

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      setNotification({
        type: "error",
        title: "입력 오류",
        message: "대상 월을 YYYY-MM 형식(예: 2026-09)으로 입력해 주세요.",
      });
      return;
    }

    const cleanSales = salesAmount.replace(/,/g, "").trim();
    const cleanCustomers = customerCount.replace(/,/g, "").trim();

    if (!cleanSales || isNaN(Number(cleanSales)) || Number(cleanSales) < 0) {
      setNotification({
        type: "error",
        title: "입력 오류",
        message: "유효한 월 매출액(0 이상의 숫자)을 입력해 주세요.",
      });
      return;
    }

    if (!cleanCustomers || isNaN(Number(cleanCustomers)) || Number(cleanCustomers) < 0) {
      setNotification({
        type: "error",
        title: "입력 오류",
        message: "유효한 월 객수/방문자 수(0 이상의 숫자)를 입력해 주세요.",
      });
      return;
    }

    const numSales = parseInt(cleanSales, 10);
    const numCustomers = parseInt(cleanCustomers, 10);
    const cleanNote = note.trim() ? note.trim() : null;

    setIsSubmitting(true);

    try {
      // Supabase upsert (지점, 월 기준 충돌 시 업데이트)
      const { data, error } = await supabase
        .from("sales")
        .upsert(
          {
            지점: branch,
            월: month,
            매출액: numSales,
            객수: numCustomers,
            비고: cleanNote,
          },
          {
            onConflict: "지점,월",
          }
        )
        .select();

      if (error) {
        throw error;
      }

      setIsExistingData(true);
      setNotification({
        type: "success",
        title: isExistingData ? "매출 데이터 수정 완료" : "매출 데이터 저장 완료",
        message: `${branch}의 ${month} 매출 데이터가 Supabase DB에 성공적으로 ${
          isExistingData ? "업데이트" : "저장"
        }되었습니다.`,
        details: {
          branch,
          month,
          sales: numSales,
          customers: numCustomers,
          note: cleanNote,
        },
      });
    } catch (err: any) {
      console.error("데이터 저장 실패:", err);
      setNotification({
        type: "error",
        title: "저장 실패",
        message: err.message || "데이터 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 금액 포맷 도우미 (한글 단위 표기)
  const formatKoreanCurrency = (val: string) => {
    const num = Number(val.replace(/,/g, ""));
    if (isNaN(num) || num <= 0) return null;
    return `${num.toLocaleString("ko-KR")} 원`;
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* 상단 네비게이션 헤더 */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            홈으로
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <BarChart3 className="w-4 h-4 mr-1" />
            대표님 대시보드 열람
          </Link>
        </div>

        {/* 메인 입력 카드 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* 카드 헤더 */}
          <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 px-6 py-7 text-white">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">지점장 매출 입력</h1>
                <p className="text-indigo-200 text-xs mt-0.5">
                  월별 실적 데이터를 입력하면 데이터베이스에 실시간으로 반영됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* 기존 데이터 상태 안내 배지 */}
          <div className="px-6 pt-5">
            {isLoadingExisting ? (
              <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span>해당 지점 및 월의 기존 데이터 조회 중...</span>
              </div>
            ) : isExistingData ? (
              <div className="flex items-center justify-between text-xs text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>
                    <strong>기존 등록 데이터가 있습니다.</strong> 제출 시 해당 데이터가{" "}
                    <strong>수정(업데이트)</strong>됩니다.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => checkExistingData(branch, month)}
                  className="text-amber-700 hover:underline font-medium text-xs ml-2"
                >
                  새로고침
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-xs text-emerald-800 bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>
                  <strong>신규 입력 모드:</strong> 선택하신 월의 등록된 데이터가 없습니다. 새로운 매출을 입력해 주세요.
                </span>
              </div>
            )}
          </div>

          {/* 알림 메시지 */}
          {notification && (
            <div className="px-6 pt-4">
              <div
                className={`p-4 rounded-xl border flex items-start space-x-3 ${
                  notification.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-red-50 border-red-200 text-red-900"
                }`}
              >
                {notification.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 text-sm">
                  <div className="font-semibold">{notification.title}</div>
                  <div className="mt-0.5 text-xs opacity-90">{notification.message}</div>
                  {notification.details && (
                    <div className="mt-2.5 pt-2 border-t border-emerald-200/60 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-emerald-700 font-medium">지점:</span>{" "}
                        {notification.details.branch}
                      </div>
                      <div>
                        <span className="text-emerald-700 font-medium">대상 월:</span>{" "}
                        {notification.details.month}
                      </div>
                      <div>
                        <span className="text-emerald-700 font-medium">매출액:</span>{" "}
                        {notification.details.sales.toLocaleString()}원
                      </div>
                      <div>
                        <span className="text-emerald-700 font-medium">객수:</span>{" "}
                        {notification.details.customers.toLocaleString()}명
                      </div>
                      {notification.details.note && (
                        <div className="col-span-2">
                          <span className="text-emerald-700 font-medium">비고:</span>{" "}
                          {notification.details.note}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 입력 폼 */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* 1. 지점명 드롭다운 */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5 flex items-center">
                <Store className="w-4 h-4 mr-1.5 text-indigo-600" />
                지점명 <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl shadow-sm text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                required
              >
                {BRANCH_LIST.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. 대상 월 */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5 flex items-center">
                <Calendar className="w-4 h-4 mr-1.5 text-indigo-600" />
                대상 월 <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl shadow-sm text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                required
              />
              <p className="text-xs text-slate-500 mt-1">예: 2026-09</p>
            </div>

            {/* 3. 월 매출액 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-slate-800 flex items-center">
                  <DollarSign className="w-4 h-4 mr-1.5 text-indigo-600" />
                  월 매출액 (원) <span className="text-red-500 ml-1">*</span>
                </label>
                {salesAmount && formatKoreanCurrency(salesAmount) && (
                  <span className="text-xs font-semibold text-indigo-600">
                    {formatKoreanCurrency(salesAmount)}
                  </span>
                )}
              </div>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="예: 48500000"
                value={salesAmount}
                onChange={(e) => setSalesAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl shadow-sm text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors placeholder:text-slate-400"
                required
              />
            </div>

            {/* 4. 월 객수/방문자 수 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-slate-800 flex items-center">
                  <Users className="w-4 h-4 mr-1.5 text-indigo-600" />
                  월 객수/방문자 수 (명) <span className="text-red-500 ml-1">*</span>
                </label>
                {customerCount && !isNaN(Number(customerCount)) && (
                  <span className="text-xs font-semibold text-indigo-600">
                    {Number(customerCount).toLocaleString("ko-KR")} 명
                  </span>
                )}
              </div>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="예: 6100"
                value={customerCount}
                onChange={(e) => setCustomerCount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl shadow-sm text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors placeholder:text-slate-400"
                required
              />
            </div>

            {/* 5. 특이사항/메모 */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5 flex items-center">
                <FileText className="w-4 h-4 mr-1.5 text-indigo-600" />
                특이사항 / 메모 <span className="text-slate-400 text-xs font-normal ml-1">(선택)</span>
              </label>
              <textarea
                rows={3}
                placeholder="예: 매장 리뉴얼 오픈, 앞 도로 공사, 단축 영업 등 특이사항 기재"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl shadow-sm text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors placeholder:text-slate-400 resize-none"
              />
            </div>

            {/* 제출 버튼 */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || isLoadingExisting}
                className="w-full flex items-center justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    저장 중...
                  </>
                ) : isExistingData ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    매출 데이터 수정(업데이트)하기
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    매출 데이터 저장하기
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* 하단 안내 풋터 */}
        <div className="text-center text-xs text-slate-500 space-y-1">
          <p>※ 입력하신 데이터는 대표님 대시보드 그래프에 실시간으로 집계 및 표시됩니다.</p>
          <p>※ 동일한 지점과 월을 선택하고 제출하시면 기존 데이터가 자동으로 갱신(Upsert)됩니다.</p>
        </div>
      </div>
    </div>
  );
}
