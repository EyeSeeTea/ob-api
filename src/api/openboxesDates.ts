/* OpenBoxes partialReceiving accepts datetimes only as "MM/dd/yyyy HH:mm Z", in UTC. */
export function toOpenBoxesDateTime(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, "0");
    const day = `${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}/${date.getUTCFullYear()}`;
    return `${day} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} Z`;
}
