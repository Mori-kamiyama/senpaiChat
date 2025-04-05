// components/ChatInterface.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import { Send, Bot, User, AlertCircle, ChevronDown } from 'lucide-react'; // Search を削除
import Image from "next/image";

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date;
}

// 環境変数は NEXT_PUBLIC_ プレフィックスが必要な場合があります
const apiProxyPath = 'http://chat.toromino.net8080/generate';

// --- sampleQuestions と QuestionTag は削除 ---

// モノクロームのメッセージバブル
// components/ChatInterface.tsx
// ... (他のimportやコードはそのまま)

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
                        whiteSpace: 'pre-wrap', // 改行を保持
                        wordBreak: 'break-word', // 長い単語を折り返す
                        // オプション: 最小高さを確保したい場合
                        // minHeight: '3.25rem', // 例: padding + 1行分の高さ程度
                    }}
                >
                    {/* ローディング中の場合のみ LoadingIndicator を表示 */}
                    {role === 'assistant' && content === '' && <LoadingIndicator />}

                    {/* コンテンツがある場合は表示 */}
                    {content && (
                        <div className={`font-medium ${isUser ? 'text-white/90' : 'text-gray-900'} leading-relaxed`}>
                            {content}
                        </div>
                    )}

                    {/* === 以下の条件分岐を削除 === */}
                    {/*
                    {!content && role !== 'user' && !(<LoadingIndicator />) && (
                        <div className="opacity-0">.</div> // 高さを保つためのダミー（または空にする）
                    )}
                    */}
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

// --- QuestionTag は削除 ---

const ChatInterface: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    // --- showSampleQuestions ステートは削除 ---

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        const handleScroll = () => {
            const container = messagesEndRef.current?.parentElement;
            if (container) {
                const isScrolledUp = container.scrollTop + container.clientHeight < container.scrollHeight - 100;
                setShowScrollButton(isScrolledUp);
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

    // --- メッセージ数によるサンプル質問表示制御の useEffect は削除 ---

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const resetChat = () => {
        abortControllerRef.current?.abort();
        setMessages([]);
        setInput('');
        setIsLoading(false);
        setError(null);
        // --- setShowSampleQuestions(true) は削除 ---
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
        const newAssistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: '', // Initially empty, loading handled in MessageBubble
            timestamp: new Date()
        };

        setMessages((prev) => [...prev, userMessage, newAssistantMessage]);
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
                // エラー時もアシスタントメッセージが存在すればそこにエラー内容を追記
                setMessages(prev => prev.map(msg =>
                    msg.id === assistantMessageId ? { ...msg, content: `[エラーが発生しました: ${errorBody}]` } : msg
                ));
                throw new Error(errorBody);
            }

            if (!response.body) {
                throw new Error('Response body is null');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let receivedDone = false;

            while (true) {
                if (abortControllerRef.current?.signal.aborted) {
                    console.log("Stream reading aborted by signal.");
                    setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
                    break;
                }

                const { value, done } = await reader.read();

                if (done) {
                    console.log("Stream finished.");
                    if (!receivedDone && messages.some(msg => msg.id === assistantMessageId)) {
                        console.warn("Stream finished without [DONE] marker, but assistant message exists.");
                    }
                    break;
                }

                buffer += decoder.decode(value, { stream: true });

                let boundary = buffer.indexOf('\n');
                while (boundary !== -1) {
                    const line = buffer.substring(0, boundary).trim();
                    buffer = buffer.substring(boundary + 1);

                    if (line.startsWith('data:')) {
                        const dataPart = line.substring(5).trimStart();

                        if (dataPart === '[DONE]') {
                            console.log("SSE: Received [DONE] marker.");
                            receivedDone = true;
                            continue;
                        }

                        if (dataPart) {
                            setMessages((prev) =>
                                prev.map((msg) =>
                                    msg.id === assistantMessageId
                                        ? { ...msg, content: msg.content + dataPart }
                                        : msg
                                )
                            );
                        }
                    } else if (line.startsWith('event: error')) {
                        const errorDataLine = buffer.split('\n').find(l => l.startsWith('data:'));
                        const errorData = errorDataLine?.substring(5).trim() ?? 'Unknown error reported by stream';
                        console.error('SSE Error Event:', errorData);
                        const formattedError = `\n\n[エラー: ${errorData}]`;
                        setError(`Stream Error: ${errorData}`);
                        setMessages((prev) =>
                            prev.map((msg) =>
                                msg.id === assistantMessageId
                                    ? { ...msg, content: msg.content + formattedError }
                                    : msg
                            )
                        );
                        reader.cancel();
                        if (abortControllerRef.current) {
                            abortControllerRef.current.abort();
                        }
                        setIsLoading(false);
                        return;

                    } else if (line.startsWith('event: end')) {
                        console.log("SSE End Event received.");
                    }

                    boundary = buffer.indexOf('\n');
                }
                if (abortControllerRef.current?.signal.aborted) {
                    console.log("Stream reading aborted by signal (inside inner while).");
                    setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
                    break;
                }
            }

        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                console.log('Fetch aborted.');
                setError(null);
            } else {
                console.error('Chat fetch/stream error:', err);
                const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました';
                setError(errorMessage); // グローバルエラー状態を設定
                // handleSubmitの冒頭でエラー時にアシスタントメッセージに追記する処理を入れたので、ここではグローバルエラー設定のみでも良いかも
                // 必要ならここでも setMessages で追記する
                // setMessages(prev => prev.map(msg =>
                //     msg.id === assistantMessageId
                //         ? { ...msg, content: (msg.content ? msg.content + '\n\n' : '') + `[エラーが発生しました: ${errorMessage}]` }
                //         : msg
                // ));
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
            inputRef.current?.focus();
        }
    }, [isLoading, apiProxyPath]); // 依存配列から showSampleQuestions などを削除

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

    // --- handleSampleQuestionClick は削除 ---

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-10 border-b border-gray-200">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4 md:justify-start md:space-x-10">
                        <div className="flex justify-start lg:w-0 lg:flex-1">
                            <div className="flex items-center cursor-pointer" onClick={resetChat} title="チャットをリセット">
                                <div className="p-1.5 bg-black rounded-lg shadow-lg shadow-black/10 mr-3">
                                    <Bot size={24} className="text-white"/>
                                </div>
                                <h1 className="text-2xl font-bold text-black">
                                    SenpaiChat
                                </h1>
                            </div>
                        </div>
                        <Image src="https://kamiyama.ac.jp/img/common/logo.svg" alt="高専ロゴ" width={90} height={50} priority />
                    </div>
                </div>
            </header>

            {/* Messages Area */}
            <div className="flex-1 flex flex-col items-center w-full overflow-hidden relative">
                <div className="flex-1 overflow-y-auto w-full max-w-4xl px-4 lg:px-0 pt-8 pb-40 scroll-smooth"> {/* 下部のpaddingを増やす */}
                    {messages.length === 0 && !isLoading && (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center p-8 max-w-lg rounded-2xl bg-white shadow-xl border border-gray-100">
                                <div className="mx-auto w-16 h-16 mb-4 bg-black rounded-full flex items-center justify-center shadow-lg shadow-black/10">
                                    <Bot size={32} className="text-white" />
                                </div>
                                <h2 className="text-2xl font-semibold text-gray-800 mb-3">SenpaiChatへようこそ</h2>
                                <p className="text-gray-600 mb-6">質問や会話を始めましょう。AI先輩があなたをサポートします。</p>
                                {/* --- 初期画面のサンプル質問表示は削除 --- */}
                            </div>
                        </div>
                    )}

                    {messages.map((msg) => (
                        <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
                    ))}

                    {/* グローバルエラー表示 (オプション) */}
                    {error && !isLoading && (
                        <div className="mt-4 p-4 text-sm text-red-700 bg-red-50 rounded-xl border border-red-200 flex items-center gap-3 shadow-md max-w-4xl mx-auto px-4 lg:px-0" role="alert">
                            <AlertCircle size={20} className="flex-shrink-0 text-red-500" />
                            <div>
                                <span className="font-medium">エラー:</span> {error}
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Scroll to bottom button */}
                {showScrollButton && (
                    <button
                        onClick={scrollToBottom}
                        className="absolute bottom-40 right-6 md:right-8 p-3 rounded-full bg-white shadow-lg border border-gray-100 text-gray-600 hover:text-black transition-all duration-200 hover:shadow-xl"
                        aria-label="最下部にスクロール"
                    >
                        <ChevronDown size={20} />
                    </button>
                )}
            </div>

            {/* Input Area */}
            <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-gray-100 via-gray-50 to-transparent pb-6 pt-12 pointer-events-none">
                <div className="max-w-4xl mx-auto px-4 pointer-events-auto">
                    {/* --- 入力エリア上部のサンプル質問表示は削除 --- */}

                    <form
                        onSubmit={handleFormSubmit}
                        className="relative flex items-center bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden transition-all duration-300 focus-within:shadow-lg focus-within:border-gray-300 mt-3" // サンプル削除に伴いマージン調整
                    >
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder="SenpaiChatに質問を入力... (Enterで送信)"
                            className="flex-1 py-4 px-6 border-none focus:outline-none focus:ring-0 text-gray-800 placeholder-gray-500 bg-transparent text-base"
                            disabled={isLoading}
                            required
                        />
                        <button
                            type="submit"
                            className={`mr-2 my-1.5 flex-shrink-0 p-3 rounded-lg text-white transition-all duration-300 ease-in-out ${
                                isLoading || !input.trim()
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 shadow-md hover:shadow-lg'
                            }`}
                            disabled={isLoading || !input.trim()}
                            aria-label="送信"
                        >
                            <Send size={20} />
                        </button>
                    </form>
                    <p className="text-xs text-center text-gray-400 mt-2">SenpaiChatはAIによって生成された回答を提供します。内容の正確性を保証するものではありません。</p>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;