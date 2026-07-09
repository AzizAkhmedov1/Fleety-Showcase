'use client';
import dynamic from 'next/dynamic';
const GlobalAssistant = dynamic(() => import('@/components/ai/GlobalAssistant'), {
    ssr: false,
});
export default function GlobalAssistantWrapper() {
    return <GlobalAssistant />;
}
