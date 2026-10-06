"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { supabase, type SalesRecord } from "@/lib/supabaseClient";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Store,
  DollarSign,
  Users,
  TrendingUp,
  RefreshCw,
  Sparkles,
  CalendarDays,
  Download,
  Coffee,
  HelpCircle,
  TrendingDown,
  FileSpreadsheet,
} from "lucide-react";

const BRANCH_COLORS: Record<string, string> = {
  용산역점: "#4f46e5", // Indigo
  삼각지점: "#06b6d4", // Cyan
  이태원점: "#f59e0b", // Amber
  효창공원점: "#10b981", // Emerald
  한남점: "#f43f5e", // Rose
};

const ALL_BRANCHES = ["용산역점", "삼각지점", "이태원점", "효창공원점", "한남점"];

interface MonthHolidayInfo {
  count: number;
  holidays: string[];
}

export default function DashboardPage() {
  const [salesList, setSalesList] = useState<SalesRecord[]>([]);
  const [holidaysMap, setHolidaysMap] = useState<Record<string, MonthHolidayInfo>>({});
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Supabase 매출 데이터 조회
  const fetchSalesData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .order("월", { ascending: true })
        .order("지점", { ascending: true });

      if (error) {
        throw error;
      }

      setSalesList((data as unknown as SalesRecord[]) || []);
    } catch (err: any) {
      console.error("매출 데이터 로딩 실패:", err);
      setErrorMsg("매출 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 2. 공공데이터포털 공휴일 API 연동
  const fetchHolidays = useCallback(async () => {
    try {
      const res = await fetch("/api/holidays?year=2026");
      if (res.ok) {
        const json = await res.json();
        if (json.months) {
          setHolidaysMap(json.months);
        }
      }
    } catch (err) {
      console.warn("공휴일 데이터 로딩 실패:", err);
    }
  }, []);

  useEffect(() => {
    fetchSalesData();
    fetchHolidays();
  }, [fetchSalesData, fetchHolidays]);

  // 대상 월 목록 추출 (정렬)
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    salesList.forEach((item) => {
      if (item.월) monthSet.add(item.월);
    });
    return Array.from(monthSet).sort();
  }, [salesList]);

  // 차트용 피벗 데이터 변환: X축(월) 기준 각 지점 매출액 매핑
  const chartData = useMemo(() => {
    return availableMonths.map((m) => {
      const row: Record<string, any> = { 월: m };
      const holidayInfo = holidaysMap[m] || { count: 0, holidays: [] };
      row.holidayCount = holidayInfo.count;
      row.holidayNames = holidayInfo.holidays;

      let monthTotal = 0;
      ALL_BRANCHES.forEach((b) => {
        const match = salesList.find((item) => item.월 === m && item.지점 === b);
        const amount = match ? match.매출액 : 0;
        row[b] = amount;
        monthTotal += amount;
      });
      row.totalSales = monthTotal;

      return row;
    });
  }, [availableMonths, salesList, holidaysMap]);

  // 주요 KPI 요약 통계 계산
  const summaryKpis = useMemo(() => {
    const filtered =
      selectedBranch === "all"
        ? salesList
        : salesList.filter((s) => s.지점 === selectedBranch);

    const totalSales = filtered.reduce((acc, cur) => acc + (cur.매출액 || 0), 0);
    const totalCustomers = filtered.reduce((acc, cur) => acc + (cur.객수 || 0), 0);
    const avgTicket = totalCustomers > 0 ? Math.round(totalSales / totalCustomers) : 0;

    // 지점별 매출 1위 계산
    const branchTotals: Record<string, number> = {};
    salesList.forEach((s) => {
      branchTotals[s.지점] = (branchTotals[s.지점] || 0) + s.매출액;
    });
    let topBranch = "-";
    let topBranchSales = 0;
    Object.entries(branchTotals).forEach(([branchName, total]) => {
      if (total > topBranchSales) {
        topBranchSales = total;
        topBranch = branchName;
      }
    });

    // 최근 월 MoM(전월 대비) 계산
    let latestMoM: { rate: number; isUp: boolean } | null = null;
    if (availableMonths.length >= 2) {
      const latestMonth = availableMonths[availableMonths.length - 1];
      const prevMonth = availableMonths[availableMonths.length - 2];

      const latestSales = filtered
        .filter((s) => s.월 === latestMonth)
        .reduce((a, b) => a + b.매출액, 0);
      const prevSales = filtered
        .filter((s) => s.월 === prevMonth)
        .reduce((a, b) => a + b.매출액, 0);

      if (prevSales > 0) {
        const diffRate = ((latestSales - prevSales) / prevSales) * 100;
        latestMoM = {
          rate: Math.abs(Number(diffRate.toFixed(1))),
          isUp: diffRate >= 0,
        };
      }
    }

    return {
      totalSales,
      totalCustomers,
      avgTicket,
      topBranch,
      topBranchSales,
      latestMoM,
    };
  }, [salesList, selectedBranch, availableMonths]);

  // 공휴일 vs 매출 상관관계 분석 (대표님의 「그 달 휴일이 많았어?」 질문 해결)
  const holidayInsight = useMemo(() => {
    if (availableMonths.length === 0) return null;

    // 월별 총매출과 공휴일 수
    const monthStats = availableMonths.map((m) => {
      const total = salesList
        .filter((s) => s.월 === m)
        .reduce((sum, item) => sum + item.매출액, 0);
      const holidayCount = holidaysMap[m]?.count ?? 0;
      return { month: m, total, holidayCount };
    });

    const highHolidayMonths = monthStats.filter((m) => m.holidayCount >= 2);
    const lowHolidayMonths = monthStats.filter((m) => m.holidayCount < 2);

    const avgHigh =
      highHolidayMonths.length > 0
        ? highHolidayMonths.reduce((a, b) => a + b.total, 0) / highHolidayMonths.length
        : 0;
    const avgLow =
      lowHolidayMonths.length > 0
        ? lowHolidayMonths.reduce((a, b) => a + b.total, 0) / lowHolidayMonths.length
        : 0;

    const diffPercent =
      avgLow > 0 ? (((avgHigh - avgLow) / avgLow) * 100).toFixed(1) : "0";

    return {
      highCount: highHolidayMonths.length,
      lowCount: lowHolidayMonths.length,
      avgHigh,
      avgLow,
      diffPercent,
    };
  }, [availableMonths, salesList, holidaysMap]);

  // 통화 서식
  const formatWon = (value: number) => {
    return `${(value / 10000).toLocaleString("ko-KR")}만 원`;
  };

  const formatFullWon = (value: number) => {
    return `${value.toLocaleString("ko-KR")}원`;
  };

  // CSV 내보내기 (엑셀 호환)
  const handleExportCSV = () => {
    if (salesList.length === 0) return;

    const headers = ["월", "지점", "매출액", "객수", "객단가", "해당월_공휴일수", "비고"];
    const rows = salesList.map((item) => {
      const ticket = item.객수 > 0 ? Math.round(item.매출액 / item.객수) : 0;
      const holidayCount = holidaysMap[item.월]?.count ?? 0;
      return [
        `"${item.월}"`,
        `"${item.지점}"`,
        item.매출액,
        item.객수,
        ticket,
        holidayCount,
        `"${(item.비고 || "").replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `오늘의원두_지점매출실적_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 차트 커스텀 툴팁
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const holidayInfo = holidaysMap[label];
      const holidayCount = holidayInfo?.count ?? 0;
      const holidayList = holidayInfo?.holidays || [];

      return (
        <div className="bg-white/95 backdrop-blur-sm p-4 rounded-xl border border-slate-200 shadow-xl text-xs space-y-2 min-w-[210px]">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="font-bold text-slate-900 text-sm">{label} 매출</span>
            <span className="px-2 py-0.5 rounded-full font-semibold bg-rose-50 text-rose-600 border border-rose-200">
              공휴일: {holidayCount}일
            </span>
          </div>
          {holidayList.length > 0 && (
            <div className="text-[11px] text-slate-500">
              공휴일: {holidayList.join(", ")}
            </div>
          )}
          <div className="space-y-1.5 pt-1">
            {payload.map((entry: any) => (
              <div key={entry.name} className="flex items-center justify-between">
                <span className="flex items-center space-x-1.5 font-medium text-slate-700">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span>{entry.name}:</span>
                </span>
                <span className="font-semibold text-slate-900">
                  {formatFullWon(entry.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* 상단 네비게이션 및 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-md bg-amber-100 text-amber-800">
                <Coffee className="w-3.5 h-3.5 mr-1" />
                오늘의원두
              </span>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-indigo-100 text-indigo-700">
                Executive View
              </span>
              <span className="text-xs text-slate-400">실시간 Supabase 연동</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              대표님 통합 매출 대시보드
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              지점별·월별 매출 추이와 공휴일 상관관계를 실시간으로 확인합니다.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={handleExportCSV}
              disabled={salesList.length === 0}
              className="inline-flex items-center px-3.5 py-2 rounded-xl text-sm font-medium text-slate-700 bg-white border border-slate-300 shadow-sm hover:bg-slate-50 focus:outline-none transition-colors"
            >
              <Download className="w-4 h-4 mr-1.5 text-slate-500" />
              엑셀(CSV) 저장
            </button>
            <button
              onClick={() => {
                fetchSalesData();
                fetchHolidays();
              }}
              disabled={isLoading}
              className="inline-flex items-center px-3.5 py-2 rounded-xl text-sm font-medium text-slate-700 bg-white border border-slate-300 shadow-sm hover:bg-slate-50 focus:outline-none transition-colors"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              새로고침
            </button>
            <Link
              href="/input"
              className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors"
            >
              <Store className="w-4 h-4 mr-1.5" />
              지점장 매출 입력
            </Link>
          </div>
        </div>

        {/* 오류 배너 */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
            {errorMsg}
          </div>
        )}

        {/* 1. 핵심 KPI 요약 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">누적 총매출액</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900">
              {formatWon(summaryKpis.totalSales)}
            </div>
            <div className="flex items-center justify-between mt-1 text-xs">
              <span className="text-slate-500">
                {selectedBranch === "all" ? "전 지점 누적 합계" : `${selectedBranch} 누적`}
              </span>
              {summaryKpis.latestMoM && (
                <span
                  className={`inline-flex items-center font-bold ${
                    summaryKpis.latestMoM.isUp ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {summaryKpis.latestMoM.isUp ? (
                    <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                  )}
                  전월대비 {summaryKpis.latestMoM.isUp ? "+" : "-"}
                  {summaryKpis.latestMoM.rate}%
                </span>
              )}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">누적 총방문객</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900">
              {summaryKpis.totalCustomers.toLocaleString()} 명
            </div>
            <p className="text-xs text-slate-500 mt-1">
              월평균{" "}
              {(summaryKpis.totalCustomers / (availableMonths.length || 1)).toFixed(0)}
              명 방문
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">평균 객단가</span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900">
              {formatFullWon(summaryKpis.avgTicket)}
            </div>
            <p className="text-xs text-slate-500 mt-1">방문객 1인당 평균 결제금액</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">최고 매출 지점</span>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900">
              {summaryKpis.topBranch}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              누적 {formatWon(summaryKpis.topBranchSales)}
            </p>
          </div>
        </div>

        {/* 2. 대표님 브리핑: 공휴일-매출 상관관계 분석 배너 */}
        {holidayInsight && (
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-xs font-bold border border-rose-500/30">
                  대표님 질문 브리핑
                </span>
                <span className="text-xs text-slate-300">「그 달 휴일이 많았어?」</span>
              </div>
              <h3 className="text-base font-bold text-white">
                공휴일이 많은 달(2일 이상)은 적은 달 대비 월평균 매출{" "}
                <span className="text-amber-300">
                  {Number(holidayInsight.diffPercent) >= 0 ? "+" : ""}
                  {holidayInsight.diffPercent}%
                </span>{" "}
                변동 추세를 보입니다.
              </h3>
              <p className="text-xs text-slate-400">
                공휴일 2일 이상인 달 평균: {formatWon(holidayInsight.avgHigh)} / 공휴일 0~1일인 달
                평균: {formatWon(holidayInsight.avgLow)}
              </p>
            </div>
            <div className="text-xs bg-white/10 px-4 py-2.5 rounded-xl border border-white/10 flex items-center space-x-2 self-stretch md:self-auto justify-center">
              <CalendarDays className="w-4 h-4 text-rose-400" />
              <span>실시간 특일정보 API 연동 중</span>
            </div>
          </div>
        )}

        {/* 3. 메인 시각화: 지점별·월별 막대그래프 + 공휴일 배지 */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-indigo-600 inline" />
                월별 지점 매출 추이 및 공휴일 일수
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                각 월 상단의 배지는 공공데이터포털 「특일 정보」 API로 연동된 해당 월의 총 공휴일 일수입니다.
              </p>
            </div>

            {/* 지점 필터 탭 */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setSelectedBranch("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  selectedBranch === "all"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                전체 지점 비교
              </button>
              {ALL_BRANCHES.map((b) => (
                <button
                  key={b}
                  onClick={() => setSelectedBranch(b)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 ${
                    selectedBranch === b
                      ? "text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  style={{
                    backgroundColor: selectedBranch === b ? BRANCH_COLORS[b] : undefined,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{
                      backgroundColor:
                        selectedBranch === b ? "#ffffff" : BRANCH_COLORS[b],
                    }}
                  />
                  <span>{b}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 차트 상단: 각 월별 공휴일 배지 스트립 */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2.5">
              <div className="flex items-center space-x-2">
                <CalendarDays className="w-4 h-4 text-rose-500" />
                <span>월별 공휴일 현황 (공공데이터포털 특일 정보 연동)</span>
              </div>
              <span className="text-[11px] text-slate-400">※ 빨간 배지는 공휴일 총일수</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              {availableMonths.map((m) => {
                const info = holidaysMap[m] || { count: 0, holidays: [] };
                return (
                  <div
                    key={m}
                    className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between"
                  >
                    <span className="text-[11px] font-bold text-slate-500">{m}</span>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                        공휴일: {info.count}일
                      </span>
                    </div>
                    {info.holidays.length > 0 ? (
                      <span
                        className="text-[10px] text-slate-400 mt-1 truncate"
                        title={info.holidays.join(", ")}
                      >
                        {info.holidays.join(", ")}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-300 mt-1">공휴일 없음</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recharts 막대 차트 */}
          <div className="h-96 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="월"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickFormatter={(val) => `${(val / 10000000).toFixed(0)}천만`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: "15px" }}
                  formatter={(value) => (
                    <span className="text-xs font-medium text-slate-700">{value}</span>
                  )}
                />

                {/* 지점별 막대 렌더링 */}
                {selectedBranch === "all" ? (
                  ALL_BRANCHES.map((b) => (
                    <Bar
                      key={b}
                      dataKey={b}
                      name={b}
                      fill={BRANCH_COLORS[b]}
                      radius={[4, 4, 0, 0]}
                    />
                  ))
                ) : (
                  <Bar
                    dataKey={selectedBranch}
                    name={selectedBranch}
                    fill={BRANCH_COLORS[selectedBranch]}
                    radius={[6, 6, 0, 0]}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. 상세 데이터 테이블 (비고 및 메모 포함) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">지점별 상세 실적 목록</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                지점장이 입력한 특이사항 및 월별 실적 원본 데이터
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-xs text-slate-500 font-medium">
                총 {salesList.length}건
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">대상 월</th>
                  <th className="py-3 px-4">지점</th>
                  <th className="py-3 px-4 text-right">월 매출액</th>
                  <th className="py-3 px-4 text-right">방문객 수</th>
                  <th className="py-3 px-4 text-right">객단가</th>
                  <th className="py-3 px-4">해당 월 공휴일</th>
                  <th className="py-3 px-4">특이사항 / 비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesList
                  .filter((item) =>
                    selectedBranch === "all" ? true : item.지점 === selectedBranch
                  )
                  .map((item, idx) => {
                    const ticket =
                      item.객수 > 0 ? Math.round(item.매출액 / item.객수) : 0;
                    const holInfo = holidaysMap[item.월];
                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          {item.월}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center space-x-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{ backgroundColor: BRANCH_COLORS[item.지점] }}
                            />
                            <span className="font-medium text-slate-800">{item.지점}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                          {formatFullWon(item.매출액)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 whitespace-nowrap">
                          {item.객수.toLocaleString()} 명
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap">
                          {ticket.toLocaleString()} 원
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                            {holInfo ? `공휴일: ${holInfo.count}일` : "조회 중"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-xs">
                          {item.비고 ? (
                            <span className="inline-block px-2 py-1 bg-amber-50 text-amber-800 rounded border border-amber-200">
                              {item.비고}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
