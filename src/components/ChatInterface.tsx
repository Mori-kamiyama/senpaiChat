// components/ChatInterface.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import { Send, Bot, User, AlertCircle, ChevronDown, Search } from 'lucide-react';
import Image from "next/image";

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date;
}

interface SampleQuestion {
    id: string;
    text: string;
}

const apiProxyPath = process.env.NEXT_PUBLIC_RAG_API_PROXY_PATH || '/api/generate';

// サンプル質問データ
const sampleQuestions: SampleQuestion[] = [
    { id: 'q1', text: '人工知能について教えてください' },
    { id: 'q2', text: '寮生活で困ったときは誰に聞けばいい？' },
    { id: 'q3', text: '良い睡眠をとるコツは？' },
    { id: 'q4', text: '神山まるごと高専って？' },
];

// モノクロームのメッセージバブル
const MessageBubble: React.FC<{ role: 'user' | 'assistant', content: string }> = ({ role, content }) => {
    const isUser = role === 'user';
    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-5 group`}>
            <div className={`flex items-start gap-3 max-w-[80%] transition-all duration-300`}>
                <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-md ${
                    isUser ? 'bg-black order-last' : 'bg-gray-800'
                }`}>
                    {isUser ?
                        <User size={18} className="text-white/90" /> :
                        <Bot size={18} className="text-white/90" />
                    }
                </div>
                <div
                    className={`px-5 py-4 rounded-2xl ${
                        isUser
                            ? 'bg-black text-white shadow-lg shadow-black/10'
                            : 'bg-white text-gray-800 border-0 shadow-lg shadow-gray-200/50'
                    }`}
                    style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                    }}
                >
                    <div className={`font-medium ${isUser ? 'text-white/90' : 'text-gray-900'} leading-relaxed`}>
                        {content}
                    </div>
                </div>
            </div>
        </div>
    );
};

// モノクロームのローディングインジケーター
const LoadingIndicator: React.FC = () => (
    <div className="flex space-x-1.5 items-center px-1">
        <span className="w-2 h-2 bg-gray-500 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
        <span className="w-2 h-2 bg-gray-500 rounded-full animate-pulse [animation-delay:-0.15s]"></span>
        <span className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></span>
    </div>
);

// サンプル質問タグ
const QuestionTag: React.FC<{ question: SampleQuestion, onClick: () => void }> = ({ question, onClick }) => (
    <button
        onClick={onClick}
        className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors duration-200 shadow-sm flex items-center gap-2 whitespace-nowrap"
    >
        <Search size={14} />
        {question.text}
    </button>
);

const ChatInterface: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [showSampleQuestions, setShowSampleQuestions] = useState(true);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        const handleScroll = () => {
            if (messagesEndRef.current) {
                const container = messagesEndRef.current.parentElement;
                if (container) {
                    const isScrolledUp = container.scrollTop + container.clientHeight < container.scrollHeight - 100;
                    setShowScrollButton(isScrolledUp);
                }
            }
        };

        const container = messagesEndRef.current?.parentElement;
        if (container) {
            container.addEventListener('scroll', handleScroll);
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, []);

    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
        };
    }, []);

    // 最初のメッセージが送信されたら、サンプル質問を非表示にする
    useEffect(() => {
        if (messages.length > 0) {
            setShowSampleQuestions(false);
        }
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // チャットをリセットする関数
    const resetChat = () => {
        // 進行中のリクエストをキャンセル
        abortControllerRef.current?.abort();
        // 状態をリセット
        setMessages([]);
        setInput('');
        setIsLoading(false);
        setError(null);
        setShowSampleQuestions(true);
    };

    // 改良されたSSEデータ処理関数
    const processSSEData = (chunk: string, assistantMessageId: string) => {
        // SSEデータチャンクを行ごとに分割して処理
        // サーバーからのデータ形式に合わせて、必要なら \r\n も考慮する
        const lines = chunk.split('\n');
        let processedContent = ''; // このチャンクから抽出されたコンテンツを一時的に保持

        for (const line of lines) {
            // data: で始まる行を処理
            if (line.startsWith('data:')) {
                // "data:" プレフィックスを除去
                // trimStart() で "data:" の直後の空白も除去
                const dataPart = line.substring(5).trimStart();

                // 終了マーカー [DONE] をチェック
                if (dataPart === '[DONE]') {
                    console.log("SSE: Received [DONE] marker.");
                    // [DONE] 自体は表示コンテンツではないので、この行の処理はここで終了
                    continue;
                }

                // データ部分が空でない場合のみ追加
                if (dataPart) {
                    // 抽出したデータ（テキストフラグメント）を連結
                    // 注: SSEの仕様では、1メッセージ内の複数data行は改行で連結されるべきですが、
                    //     LLMなどのストリーミングAPIは、意図したテキストの断片を
                    //     連続した data: イベントとして送ることが多いです。
                    //     サーバーがデータ内に '\n' を含めて送信しない限り、ここでは改行を追加しません。
                    //     もしサーバーがJSON形式 (例: data: {"token": "text"}) で送る場合は、
                    //     ここでJSONパースと必要なフィールドの抽出が必要です。
                    //     例: try {
                    //            const parsed = JSON.parse(dataPart);
                    //            processedContent += parsed.text || parsed.token || '';
                    //         } catch(e) {
                    //             // JSONでない場合はそのまま追加（フォールバック）
                    //             processedContent += dataPart;
                    //         }
                    processedContent += dataPart;
                }
            } else if (line.startsWith('event: error')) {
                // エラーイベントの処理
                // 次の data: 行にエラーメッセージが含まれると仮定（サーバーの実装による）
                // このチャンク内で 'event: error' の後にある最初の 'data:' 行を探す
                const errorLineIndex = lines.indexOf(line);
                let errorData = 'Unknown error'; // デフォルトエラーメッセージ
                // エラーイベント行の次以降の行を検索
                for (let i = errorLineIndex + 1; i < lines.length; i++) {
                    if (lines[i].startsWith('data:')) {
                        errorData = lines[i].substring(5).trimStart();
                        // エラーデータがJSONの場合の処理（必要に応じて）
                        // try {
                        //     const parsedError = JSON.parse(errorData);
                        //     errorData = parsedError.message || JSON.stringify(parsedError);
                        // } catch (e) { /* ignore if not JSON */ }
                        break; // 最初の data: 行を見つけたら抜ける
                    }
                }

                console.error('SSE Error Event Data:', errorData);
                setError(`Error from SenpaiChat: ${errorData}`); // エラー状態をセット
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === assistantMessageId
                            ? { ...msg, content: msg.content + `\n\n[エラー: ${errorData}]` } // メッセージにエラー情報を追記
                            : msg
                    )
                );
                // エラー発生後、このチャンクの残りの処理を続けるか中断するかは要件次第
                // break; // 中断する場合

            } else if (line.startsWith('event: end')) {
                // 終了イベント（[DONE]マーカーが使われる場合、これは情報的なことが多い）
                console.log("SSE End Event received.");
            }
            // 他の行（例: 'event: message', 'id: 123', コメント行 ':', 空行など）は、
            // コンテンツ表示の観点からは基本的に無視します。
        }

        // 処理されたコンテンツ（このチャンクから抽出されたテキスト）が存在する場合、
        // 対応するメッセージの状態を更新
        if (processedContent) {
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === assistantMessageId
                        ? { ...msg, content: msg.content + processedContent } // 既存のコンテントに追記
                        : msg
                )
            );
        }
    };

    const handleSubmit = useCallback(async (query: string) => {
        if (!query.trim() || isLoading) return;

        setIsLoading(true);
        setError(null);
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: query,
            timestamp: new Date()
        };
        const assistantMessageId = `assistant-${Date.now()}`;
        setMessages((prev) => [
            ...prev,
            userMessage,
            { id: assistantMessageId, role: 'assistant', content: '', timestamp: new Date() }
        ]);
        setInput('');

        try {
            const response = await fetch(apiProxyPath, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                let errorBody = `API Error: ${response.status} ${response.statusText}`;
                try {
                    const errorJson = await response.json();
                    errorBody = errorJson.error || errorJson.message || JSON.stringify(errorJson);
                } catch {
                    try {
                        const errorText = await response.text();
                        if (errorText) errorBody = errorText;
                    } catch (textErr) {
                        console.error("Failed to read error response text:", textErr);
                    }
                }
                throw new Error(errorBody);
            }

            if (!response.body) {
                throw new Error('Response body is null');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                if (abortControllerRef.current?.signal.aborted) {
                    console.log("Stream reading aborted by signal.");
                    setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
                    break;
                }

                const { value, done } = await reader.read();

                if (done) {
                    console.log("Stream finished.");
                    setIsLoading(false);
                    abortControllerRef.current = null;
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                processSSEData(chunk, assistantMessageId);
            }

        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                console.log('Fetch aborted.');
                setError(null);
            } else {
                console.error('Chat fetch/stream error:', err);
                const errorMessage = err instanceof Error ? err.message : String(err);
                setError(errorMessage);
                setMessages(prev => prev.map(msg =>
                    msg.id === assistantMessageId ? { ...msg, content: `[エラーが発生しました: ${errorMessage}]` } : msg
                ));
            }
        } finally {
            setIsLoading(false);
            if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
                abortControllerRef.current = null;
            }
            inputRef.current?.focus();
        }
    }, [isLoading]);

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSubmit(input);
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        setInput(e.target.value);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
            e.preventDefault();
            handleSubmit(input);
        }
    };

    const handleSampleQuestionClick = (question: SampleQuestion) => {
        setInput(question.text);
        inputRef.current?.focus();
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* モノクロームヘッダー */}
            <header className="bg-white shadow-sm sticky top-0 z-10 border-b border-gray-200">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4 md:justify-start md:space-x-10">
                        <div className="flex justify-start lg:w-0 lg:flex-1">
                            <h1
                                className="text-2xl font-bold text-black flex items-center cursor-pointer"
                                onClick={resetChat}
                            >
                                <div className="p-1.5 bg-black rounded-lg shadow-lg shadow-black/10 mr-3">
                                    <Bot size={24} className="text-white"/>
                                </div>
                                SenpaiChat
                            </h1>
                        </div>
                        <Image src="https://kamiyama.ac.jp/img/common/logo.svg" alt="高専ロゴ" width={90} height={50} />
                    </div>
                </div>
            </header>

            {/* メインコンテンツエリア */}
            <div className="flex-1 flex flex-col items-center w-full overflow-hidden relative">
                <div className="flex-1 overflow-y-auto w-full max-w-4xl px-4 lg:px-0 pt-8 pb-32 scroll-smooth">
                    {messages.length === 0 && (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center p-8 max-w-lg rounded-2xl bg-white shadow-xl border border-gray-100">
                                <div className="mx-auto w-16 h-16 mb-4 bg-black rounded-full flex items-center justify-center shadow-lg shadow-black/10">
                                    <Bot size={32} className="text-white" />
                                </div>
                                <h2 className="text-2xl font-semibold text-gray-800 mb-3">SenpaiChatへようこそ</h2>
                                <p className="text-gray-600 mb-4">質問や会話を始めましょう。AI先輩があなたをサポートします。</p>
                            </div>
                        </div>
                    )}

                    {messages.map((msg) => (
                        <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
                    ))}

                    {isLoading && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content === '' && (
                        <div className="flex justify-start mb-5">
                            <div className="flex items-start gap-3 max-w-[80%]">
                                <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-md bg-gray-800">
                                    <Bot size={18} className="text-white/90" />
                                </div>
                                <div className="px-5 py-4 rounded-2xl shadow-lg bg-white text-gray-800">
                                    <LoadingIndicator />
                                </div>
                            </div>
                        </div>
                    )}

                    {error && !isLoading && (
                        <div className="mt-4 p-5 text-sm text-red-700 bg-red-50 rounded-xl border border-red-200 flex items-center gap-3 shadow-md" role="alert">
                            <AlertCircle size={20} className="flex-shrink-0 text-red-500" />
                            <div>
                                <span className="font-medium">エラー:</span> {error}
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* スクロールボタン */}
                {showScrollButton && (
                    <button
                        onClick={scrollToBottom}
                        className="absolute bottom-32 right-6 md:right-8 p-3 rounded-full bg-white shadow-lg border border-gray-100 text-gray-600 hover:text-black transition-all duration-200 hover:shadow-xl"
                        aria-label="最下部にスクロール"
                    >
                        <ChevronDown size={20} />
                    </button>
                )}
            </div>

            {/* 入力エリア */}
            <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-gray-50 to-transparent pb-6 pt-12 pointer-events-none">
                <div className="max-w-4xl mx-auto px-4 pointer-events-auto">
                    {/* サンプル質問タグ */}
                    {showSampleQuestions && (
                        <div className="mb-4 flex flex-wrap gap-2 justify-center">
                            {sampleQuestions.map(question => (
                                <QuestionTag
                                    key={question.id}
                                    question={question}
                                    onClick={() => handleSampleQuestionClick(question)}
                                />
                            ))}
                        </div>
                    )}

                    <form
                        onSubmit={handleFormSubmit}
                        className="relative flex items-center bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden transition-all duration-300 focus-within:shadow-lg focus-within:border-gray-300"
                    >
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder="SenpaiChatに質問を入力... (Enterで送信)"
                            className="flex-1 py-4 px-6 border-none focus:outline-none focus:ring-0 text-gray-700 placeholder-gray-400 bg-transparent"
                            disabled={isLoading}
                            required
                        />
                        <button
                            type="submit"
                            className={`mr-3 flex-shrink-0 p-3 rounded-xl text-white transition-all duration-300 ease-in-out ${
                                isLoading || !input.trim()
                                    ? 'bg-gray-300 cursor-not-allowed opacity-60'
                                    : 'bg-black hover:bg-gray-900 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
                            }`}
                            disabled={isLoading || !input.trim()}
                            aria-label="送信"
                        >
                            <Send size={20} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;