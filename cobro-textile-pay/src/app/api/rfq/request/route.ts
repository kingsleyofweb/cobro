import { NextRequest, NextResponse } from "next/server";

const TEXTILE_API_URL = "https://api.textilecredit.com/v2/rfq/request";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = process.env.TEXTILE_API_KEY;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(TEXTILE_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to request firm quote from Textile RFQ API", details: error.message },
      { status: 502 }
    );
  }
}
