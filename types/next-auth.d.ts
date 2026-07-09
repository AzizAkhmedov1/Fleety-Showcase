import type { DefaultSession } from 'next-auth';
declare module 'next-auth' {
    interface Session {
        user: {
            companyId?: number;
            company_id?: number;
        } & DefaultSession['user'];
    }
}
declare module 'next-auth/jwt' {
    interface JWT {
        companyId?: number;
        company_id?: number;
    }
}
