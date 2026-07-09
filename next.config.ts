import type { NextConfig } from "next";
type RemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];
function remotePatternFromUrl(rawUrl: string | undefined): RemotePattern | null {
    if (!rawUrl?.trim())
        return null;
    try {
        const parsed = new URL(rawUrl.trim());
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
            return null;
        return {
            protocol: parsed.protocol.replace(":", "") as "http" | "https",
            hostname: parsed.hostname,
            pathname: "/**",
        };
    }
    catch {
        return null;
    }
}
const backendRemotePatterns: RemotePattern[] = [
    { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
    { protocol: "https", hostname: "fleety-7p4o.onrender.com", pathname: "/**" },
    { protocol: "http", hostname: "localhost", pathname: "/**" },
    { protocol: "http", hostname: "127.0.0.1", pathname: "/**" },
];
for (const envUrl of [
    process.env.NEXT_PUBLIC_API_URL,
    process.env.API_REWRITE_DESTINATION,
]) {
    const pattern = remotePatternFromUrl(envUrl);
    if (pattern &&
        !backendRemotePatterns.some((existing) => existing.hostname === pattern.hostname && existing.protocol === pattern.protocol)) {
        backendRemotePatterns.push(pattern);
    }
}
const nextConfig: NextConfig = {
    images: {
        remotePatterns: backendRemotePatterns,
    },
    async rewrites() {
        const backendUrl = process.env.API_REWRITE_DESTINATION || 'https://fleety-7p4o.onrender.com';
        return [
            {
                source: '/api/:path((?!auth).*)',
                destination: `${backendUrl}/api/:path*`,
            },
            {
                source: '/uploaded_docs/:path*',
                destination: `${backendUrl}/uploaded_docs/:path*`,
            },
        ];
    },
};
export default nextConfig;
