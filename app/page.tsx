import Link from "next/link";
import { Store, BarChart3, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
      <div className="max-w-xl w-full text-center space-y-8">
        <div>
          <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full mb-3">
            Internal Sales Operations
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
            지점별 매출 관리 시스템
          </h1>
          <p className="mt-3 text-base text-slate-600">
            사내 지점별 매출 입력 및 실시간 대시보드 조회 플랫폼입니다.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/input"
            className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-400 transition-all text-left flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Store className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">지점장 매출 입력</h2>
              <p className="text-sm text-slate-500 mt-1">
                월별 매출액, 객수, 특이사항 입력 및 수정 (`/input`)
              </p>
            </div>
            <div className="mt-6 flex items-center text-sm font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform">
              입력 페이지 이동 <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-400 transition-all text-left flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">대표님 대시보드</h2>
              <p className="text-sm text-slate-500 mt-1">
                월별·지점별 매출 막대 차트 및 공휴일 연동 (`/dashboard`)
              </p>
            </div>
            <div className="mt-6 flex items-center text-sm font-semibold text-emerald-600 group-hover:translate-x-1 transition-transform">
              대시보드 이동 <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
