// app/api/generate/route.ts
import { type NextRequest } from 'next/server';

// API Route はサーバーサイドで実行されるため、ここで実際のAPI URLを使用
const ragApiUrl = process.env.RAG_API_URL;

export async function POST(request: NextRequest) {
    // API URLが設定されていない場合のエラーハンドリング
    if (!ragApiUrl) {
        console.error('Error: RAG_API_URL environment variable is not set.');
        return new Response(JSON.stringify({ error: 'API endpoint configuration error.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        // クライアントからのリクエストボディを取得
        const { query } = await request.json();

        // queryパラメータのバリデーション
        if (!query || typeof query !== 'string' || query.trim() === '') {
            return new Response(JSON.stringify({ error: 'Query parameter is missing or invalid.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        console.log(`Forwarding query to RAG API: ${query.substring(0, 50)}...`);

        // 実際のRAG API (FastAPI) にリクエストを転送
        const response = await fetch(ragApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // FastAPI側に認証が必要な場合は、ここでヘッダーを追加
                // 'Authorization': `Bearer ${process.env.RAG_API_KEY}`,
            },
            body: JSON.stringify({ query }),
            // 重要: duplex: 'half' を指定しないと Vercel Edge Functions などでストリーミングがうまくいかないことがある
            // 参考: https://github.com/vercel/next.js/issues/49999
            // @ts-expect-error node-fetch と型定義が異なるため無視
            duplex: 'half',
        });

        // RAG APIからのエラーレスポンスをチェック
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error response from RAG API (${response.status}): ${errorText}`);
            // エラー詳細をクライアントに返す（本番では情報を制限することも検討）
            return new Response(JSON.stringify({ error: `Failed to get response from SenpaiChat API: ${response.status}. ${errorText}` }), {
                status: response.status, // 元のエラーステータスを引き継ぐ
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // RAG APIからのSSEストリームをそのままクライアントに返す
        // Content-Typeなどのヘッダーも引き継ぐ
        const headers = new Headers(response.headers);
        headers.set('Content-Type', 'text/event-stream; charset=utf-8'); // 明示的に設定推奨
        headers.set('Cache-Control', 'no-cache');
        headers.set('Connection', 'keep-alive');

        return new Response(response.body, {
            status: 200,
            headers: headers,
        });

    } catch (error) {
        console.error('Error in API route proxy:', error);
        // 想定外のエラー
        return new Response(JSON.stringify({ error: 'An internal server error occurred while processing your request.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

// Vercelでのパフォーマンス向上のためEdge Runtimeを推奨 (Node.js固有APIを使わない場合)
export const runtime = 'edge';