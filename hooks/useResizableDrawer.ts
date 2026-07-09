import { useCallback, useState, type MouseEvent as ReactMouseEvent } from "react";
export const DRAWER_DEFAULT_WIDTH = 480;
export const DRAWER_MIN_WIDTH = 450;
export const DRAWER_MAX_WIDTH = 950;
export function clampDrawerWidth(rawWidth: number): number {
    const maxWidth = Math.min(DRAWER_MAX_WIDTH, window.innerWidth * 0.65);
    return Math.min(maxWidth, Math.max(DRAWER_MIN_WIDTH, rawWidth));
}
export function useResizableDrawer(defaultWidth = DRAWER_DEFAULT_WIDTH) {
    const [width, setWidth] = useState(defaultWidth);
    const [isDragging, setIsDragging] = useState(false);
    const handleResizeMouseDown = useCallback((event: ReactMouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
        const previousUserSelect = document.body.style.userSelect;
        document.body.style.userSelect = "none";
        const handleMouseMove = (moveEvent: MouseEvent) => {
            setWidth(clampDrawerWidth(window.innerWidth - moveEvent.clientX));
        };
        const handleMouseUp = () => {
            setIsDragging(false);
            document.body.style.userSelect = previousUserSelect;
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    }, []);
    return { width, isDragging, handleResizeMouseDown };
}
