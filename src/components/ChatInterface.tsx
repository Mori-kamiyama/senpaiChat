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

const apiProxyPath = "http://chat.toromino.net:8080/generate"; // 環境変数は NEXT_PUBLIC_ プレフィックスが必要

// サンプル質問データ
const sampleQuestions: SampleQuestion[] = [
    { id: 'q1', text: '人工知能について教えてください' },
    { id: 'q2', text: '寮生活で困ったときは誰に聞けばいい？' },
    { id: 'q3', text: 'SPって何がある？' },
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
                        whiteSpace: 'pre-wrap', // 改行を保持
                        wordBreak: 'break-word', // 長い単語を折り返す
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

    useEffect(() => {
        if (messages.length > 0) {
            setShowSampleQuestions(false);
        }
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const resetChat = () => {
        abortControllerRef.current?.abort();
        setMessages([]);
        setInput('');
        setIsLoading(false);
        setError(null);
        setShowSampleQuestions(true);
    };

    // === ここから修正 ===
    const handleSubmit = useCallback(async (query: string) => {
        if (!query.trim() || isLoading) return;

        setIsLoading(true);
        setError(null);
        abortControllerRef.current?.abort(); // 前のリクエストをキャンセル
        abortControllerRef.current = new AbortController();

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: query,
            timestamp: new Date()
        };
        const assistantMessageId = `assistant-${Date.now()}`;
        // アシスタントメッセージを初期状態（空コンテンツ）で追加
        // ローディング表示は MessageBubble 側で行う
        const newAssistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: '', // 最初は空
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
                throw new Error(errorBody);
            }

            if (!response.body) {
                throw new Error('Response body is null');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = ''; // デコードされたテキストを保持するバッファ
            let receivedDone = false; // [DONE] マーカーを受け取ったか

            while (true) {
                // 中断シグナルをチェック
                if (abortControllerRef.current?.signal.aborted) {
                    console.log("Stream reading aborted by signal.");
                    // 中断された場合、不完全なアシスタントメッセージを削除
                    setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
                    break;
                }

                const { value, done } = await reader.read();

                if (done) {
                    console.log("Stream finished.");
                    // バッファに残っているデータがあれば処理 (通常は空のはず)
                    if (buffer.trim()) {
                        console.warn("Stream finished with remaining buffer:", buffer);
                        // 必要に応じて最後のデータを処理
                    }
                    if (!receivedDone && messages.some(msg => msg.id === assistantMessageId)) {
                        console.warn("Stream finished without [DONE] marker, but assistant message exists.");
                        // DONEなしで終わったが、メッセージは存在する場合のフォールバック
                        // (エラー表示などしない場合)
                    }
                    break; // ストリーム終了
                }

                // チャンクをデコードしてバッファに追加
                buffer += decoder.decode(value, { stream: true });

                // バッファを行ごとに処理 (SSEは通常 \n\n でメッセージ区切りだが、ここでは \n で処理)
                let boundary = buffer.indexOf('\n');
                while (boundary !== -1) {
                    const line = buffer.substring(0, boundary).trim(); // 1行取得して前後の空白削除
                    buffer = buffer.substring(boundary + 1); // バッファから処理済み行を削除

                    if (line.startsWith('data:')) {
                        const dataPart = line.substring(5).trimStart(); // "data:" を削除し、先頭の空白のみ削除

                        if (dataPart === '[DONE]') {
                            console.log("SSE: Received [DONE] marker.");
                            receivedDone = true;
                            // [DONE] を受け取ったらループは reader.read() の done=true で終了するのを待つ
                            continue;
                        }

                        if (dataPart) {
                            // 実際のデータでメッセージを更新
                            setMessages((prev) =>
                                prev.map((msg) =>
                                    msg.id === assistantMessageId
                                        ? { ...msg, content: msg.content + dataPart } // 文字列を単純に連結
                                        : msg
                                )
                            );
                        }
                        // data: の後に空データが来た場合は無視される
                    } else if (line.startsWith('event: error')) {
                        // エラーイベントの処理（次の行に data: が来ることを想定）
                        // 注意: この実装は単純化されており、複数行にわたる可能性は考慮していない
                        const errorDataLine = buffer.split('\n').find(l => l.startsWith('data:'));
                        const errorData = errorDataLine?.substring(5).trim() ?? 'Unknown error reported by stream';
                        console.error('SSE Error Event:', errorData);
                        const formattedError = `\n\n[エラー: ${errorData}]`;
                        setError(`Stream Error: ${errorData}`); // UI全体のエラー状態も設定
                        setMessages((prev) =>
                            prev.map((msg) =>
                                msg.id === assistantMessageId
                                    ? { ...msg, content: msg.content + formattedError }
                                    : msg
                            )
                        );
                        // エラーストリームを受け取ったら処理を中断
                        reader.cancel(); // リーダーをキャンセル
                        if (abortControllerRef.current) {
                            abortControllerRef.current.abort(); // AbortControllerも中止扱いにする
                        }
                        setIsLoading(false); // ローディング終了
                        return; // handleSubmit関数から抜ける

                    } else if (line.startsWith('event: end')) {
                        console.log("SSE End Event received.");
                        // endイベントに対する特別な処理が必要な場合に追加
                    }
                    // コメント行 (':') や空行は無視される

                    boundary = buffer.indexOf('\n'); // 次の改行を探す
                }
                // whileループの最後に再度中断チェック
                if (abortControllerRef.current?.signal.aborted) {
                    console.log("Stream reading aborted by signal (inside inner while).");
                    setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
                    break; // 内側のwhileを抜ける (外側のwhileも次のチェックで抜ける)
                }
            }

        } catch (err) {
            // AbortErrorはユーザーによるキャンセルか、上記のエラー処理で能動的にabortした場合
            if (err instanceof Error && err.name === 'AbortError') {
                console.log('Fetch aborted.');
                // AbortErrorの場合、通常はUIにエラー表示しない
                // メッセージ削除はすでにシグナルチェックで行われているはず
                setError(null); // 念のためエラー状態をクリア
            } else {
                // その他のネットワークエラーなど
                console.error('Chat fetch/stream error:', err);
                const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました';
                setError(errorMessage);
                // アシスタントメッセージが存在すればエラー情報を追記、なければエラーメッセージのみ表示
                setMessages(prev => prev.map(msg =>
                    msg.id === assistantMessageId
                        ? { ...msg, content: (msg.content ? msg.content + '\n\n' : '') + `[エラーが発生しました: ${errorMessage}]` }
                        : msg
                ));
                // もしアシスタントメッセージ自体が追加されていない場合 (fetch直後のエラーなど) は、
                // エラー専用のメッセージを追加することも検討できる。現状は既存の枠に追記。
            }
        } finally {
            // ローディング状態を解除
            setIsLoading(false);
            // AbortControllerをリセット (次のリクエストに備える)
            // ストリームが正常終了した場合も、エラーで終了した場合も、Abortした場合もリセットしてOK
            abortControllerRef.current = null;
            // 入力フィールドにフォーカス
            inputRef.current?.focus();
        }
    }, [isLoading, apiProxyPath]); // apiProxyPath を依存配列に追加
    // === ここまで修正 ===

    // 古い processSSEData 関数は不要なのでコメントアウトまたは削除
    /*
    const processSSEData = (chunk: string, assistantMessageId: string) => {
        // ... (古いコード) ...
    };
    */

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
        handleSubmit(question.text); // サンプルクリック時も即時送信する方が自然かも
        // setInput(question.text);
        // inputRef.current?.focus(); // フォーカスだけ当てる場合
    };

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
                        {/* ロゴの代替としてテキストや他の要素を表示することも可能 */}
                        <Image src="https://kamiyama.ac.jp/img/common/logo.svg" alt="高専ロゴ" width={90} height={50} priority />
                    </div>
                </div>
            </header>

            {/* Messages Area */}
            <div className="flex-1 flex flex-col items-center w-full overflow-hidden relative">
                <div className="flex-1 overflow-y-auto w-full max-w-4xl px-4 lg:px-0 pt-8 pb-40 scroll-smooth"> {/* 下部のpaddingを増やす */}
                    {messages.length === 0 && !isLoading && ( // ローディング中でない場合のみ表示
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center p-8 max-w-lg rounded-2xl bg-white shadow-xl border border-gray-100">
                                <div className="mx-auto w-16 h-16 mb-4 bg-black rounded-full flex items-center justify-center shadow-lg shadow-black/10">
                                    <Bot size={32} className="text-white" />
                                </div>
                                <h2 className="text-2xl font-semibold text-gray-800 mb-3">SenpaiChatへようこそ</h2>
                                <p className="text-gray-600 mb-6">質問や会話を始めましょう。AI先輩があなたをサポートします。</p>
                                {/* サンプル質問を初期画面にも表示 */}
                                {showSampleQuestions && sampleQuestions.length > 0 && (
                                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                                        {sampleQuestions.map(question => (
                                            <QuestionTag
                                                key={question.id}
                                                question={question}
                                                onClick={() => handleSampleQuestionClick(question)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {messages.map((msg) => (
                        <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
                    ))}

                    {/* ローディング表示は MessageBubble 内で行うため、ここの専用ローディング表示は削除 */}
                    {/* {isLoading && messages[messages.length - 1]?.role === 'assistant' && ... } */}

                    {/* エラーメッセージ表示 (handleSubmit 内でメッセージに追加する方式に変更したので、これは任意) */}
                    {error && !isLoading && messages.length > 0 && ( // メッセージがある場合のみ表示
                        <div className="mt-4 p-4 text-sm text-red-700 bg-red-50 rounded-xl border border-red-200 flex items-center gap-3 shadow-md max-w-4xl mx-auto px-4 lg:px-0" role="alert">
                            <AlertCircle size={20} className="flex-shrink-0 text-red-500" />
                            <div>
                                <span className="font-medium">エラーが発生しました:</span> {error}
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Scroll to bottom button */}
                {showScrollButton && (
                    <button
                        onClick={scrollToBottom}
                        className="absolute bottom-40 right-6 md:right-8 p-3 rounded-full bg-white shadow-lg border border-gray-100 text-gray-600 hover:text-black transition-all duration-200 hover:shadow-xl" // 位置調整
                        aria-label="最下部にスクロール"
                    >
                        <ChevronDown size={20} />
                    </button>
                )}
            </div>

            {/* Input Area */}
            <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-gray-100 via-gray-50 to-transparent pb-6 pt-12 pointer-events-none"> {/* 背景調整 */}
                <div className="max-w-4xl mx-auto px-4 pointer-events-auto">
                    {/* サンプル質問 (入力バーの上に表示、メッセージがない場合 or メッセージがあっても表示するか選択) */}
                    {/* showSampleQuestions && messages.length === 0 && ( // メッセージがない場合のみ表示するなら */}
                    {showSampleQuestions && ( // 常に入力バーの上に表示する場合 (メッセージが増えると隠れる)
                        <div className="mb-3 flex flex-wrap gap-2 justify-center max-w-full overflow-x-auto pb-2 scrollbar-hide">
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
                            className="flex-1 py-4 px-6 border-none focus:outline-none focus:ring-0 text-gray-800 placeholder-gray-500 bg-transparent text-base" // フォントサイズ調整
                            disabled={isLoading}
                            required
                        />
                        <button
                            type="submit"
                            className={`mr-2 my-1.5 flex-shrink-0 p-3 rounded-lg text-white transition-all duration-300 ease-in-out ${ // ボタンのスタイル調整
                                isLoading || !input.trim()
                                    ? 'bg-gray-400 cursor-not-allowed' // ローディング/非アクティブ時
                                    : 'bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 shadow-md hover:shadow-lg' // アクティブ時
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