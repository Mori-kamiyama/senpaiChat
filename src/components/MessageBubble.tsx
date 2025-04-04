// components/MessageBubble.tsx
import React from 'react';
import { User, Bot } from 'lucide-react'; // アイコン使用例

interface MessageBubbleProps {
    role: 'user' | 'assistant';
    content: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ role, content }) => {
    const isUser = role === 'user';
    // 簡単なマークダウン（改行）の処理
    const formattedContent = content.split('\n').map((line, index) => (
        <React.Fragment key={index}>
            {line}
            <br />
        </React.Fragment>
    ));


    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
            <div className={`flex items-start max-w-xl ${isUser ? 'flex-row-reverse' : ''}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-blue-500 text-white ml-2' : 'bg-gray-300 text-gray-700 mr-2'}`}>
                    {isUser ? <User size={18} /> : <Bot size={18} />}
                </div>
                <div
                    className={`px-4 py-2 rounded-lg shadow ${isUser ? 'bg-blue-100 text-gray-800' : 'bg-white text-gray-800 border border-gray-200'}`}
                    style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }} // 長い単語の折り返し
                >
                    {formattedContent}
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;