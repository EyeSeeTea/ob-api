import { Maybe } from "../utils/ts-utils";

const pad = (value: number) => String(value).padStart(2, "0");

/* "MM/dd/yyyy" in UTC: the date format of the OpenBoxes command objects (for example dateRequested). */
export function toOpenBoxesDate(date: Date): string {
    return `${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}/${date.getUTCFullYear()}`;
}

/* OpenBoxes partialReceiving accepts datetimes only as "MM/dd/yyyy HH:mm Z", in UTC. */
export function toOpenBoxesDateTime(date: Date): string {
    return `${toOpenBoxesDate(date)} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} Z`;
}

/* An absent date stays absent: JSON.stringify drops the undefined field from the body. */
export function formatOptionalDate(
    date: Maybe<Date>,
    format: (date: Date) => string
): Maybe<string> {
    return date && format(date);
}
