import { NextRequest, NextResponse } from "next/server";

interface HolidayItem {
  dateKind?: string;
  dateName?: string;
  isHoliday?: string;
  locdate?: number;
  seq?: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const monthParam = searchParams.get("month"); // e.g. "2026-05" or "05"
  const yearParam = searchParams.get("year") || "2026";

  const apiKey = process.env.HOLIDAY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "HOLIDAY_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    // If a specific month is requested (e.g. 2026-05)
    if (monthParam) {
      let solYear = yearParam;
      let solMonth = monthParam;

      if (monthParam.includes("-")) {
        const parts = monthParam.split("-");
        solYear = parts[0];
        solMonth = parts[1].padStart(2, "0");
      } else {
        solMonth = monthParam.padStart(2, "0");
      }

      const holidayInfo = await fetchMonthHolidays(solYear, solMonth, apiKey);
      return NextResponse.json(holidayInfo);
    }

    // Otherwise, fetch holidays for months 01 through 12 of the given year
    const targetMonths = ["03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
    const results: Record<string, { count: number; holidays: string[] }> = {};

    await Promise.all(
      targetMonths.map(async (m) => {
        const key = `${yearParam}-${m}`;
        const data = await fetchMonthHolidays(yearParam, m, apiKey);
        results[key] = {
          count: data.count,
          holidays: data.holidays,
        };
      })
    );

    return NextResponse.json({
      year: yearParam,
      months: results,
    });
  } catch (error: any) {
    console.error("공휴일 API 조회 오류:", error);
    return NextResponse.json(
      { error: "공휴일 데이터를 가져오는 데 실패했습니다.", details: error.message },
      { status: 500 }
    );
  }
}

async function fetchMonthHolidays(
  year: string,
  month: string,
  apiKey: string
): Promise<{ month: string; count: number; holidays: string[] }> {
  const paddedMonth = month.padStart(2, "0");
  const monthKey = `${year}-${paddedMonth}`;

  // 공공데이터포털 한국천문연구원 특일 정보 (getRestDeInfo)
  const url = `http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?solYear=${year}&solMonth=${paddedMonth}&_type=json&numOfRows=50&serviceKey=${encodeURIComponent(
    apiKey
  )}`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 86400 }, // 24시간 캐싱
    });

    if (!res.ok) {
      throw new Error(`API returned status ${res.status}`);
    }

    const data = await res.json();
    const items = data?.response?.body?.items;

    if (!items || items === "") {
      return { month: monthKey, count: 0, holidays: [] };
    }

    let rawList: HolidayItem[] = [];
    if (Array.isArray(items.item)) {
      rawList = items.item;
    } else if (items.item) {
      rawList = [items.item];
    }

    // isHoliday가 'Y'인 공휴일만 필터링 (동일 날짜 중복 제거)
    const holidayDates = new Set<number>();
    const holidayNames: string[] = [];

    for (const item of rawList) {
      if (item.isHoliday === "Y" && item.locdate) {
        if (!holidayDates.has(item.locdate)) {
          holidayDates.add(item.locdate);
          if (item.dateName) {
            holidayNames.push(item.dateName);
          }
        }
      }
    }

    return {
      month: monthKey,
      count: holidayDates.size,
      holidays: holidayNames,
    };
  } catch (err) {
    console.warn(`[${monthKey}] 공휴일 API 호출 실패:`, err);
    return { month: monthKey, count: 0, holidays: [] };
  }
}
