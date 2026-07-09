export const isRateLimitError = (errorMessage?: string | null): boolean => {
    if (!errorMessage)
        return false;
    const msg = errorMessage.toLowerCase();
    return msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota exceeded');
};
