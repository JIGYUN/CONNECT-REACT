// filepath: src/shared/ui/SuspenseFallback.tsx
'use client';

type Props = {
    label?: string;
};

export default function SuspenseFallback({ label }: Props) {
    return (
        <div className="p-4">
            <div className="h-5 w-24 mb-3 animate-pulse bg-gray-200 rounded" />
            <div className="h-4 w-3/4 mb-2 animate-pulse bg-gray-200 rounded" />
            <div className="h-4 w-2/3 mb-2 animate-pulse bg-gray-200 rounded" />
            <div className="h-4 w-1/2 mb-2 animate-pulse bg-gray-200 rounded" />
            {label && <p className="text-xs text-gray-500 mt-2">{label}</p>}
        </div>
    );
}