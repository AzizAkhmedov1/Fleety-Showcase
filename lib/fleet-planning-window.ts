const toInputDate = (d: Date) => d.toISOString().slice(0, 10);
export const getFleetPlanningWindow = () => {
    const now = new Date();
    const diffToMonday = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    return { start: toInputDate(monday), end: toInputDate(nextMonday) };
};
