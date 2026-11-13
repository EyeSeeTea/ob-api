import { isDefined, Maybe } from "./ts-utils";

export type Cookies = ReadonlyMap<string, string>;

export type Cookie = Readonly<{ name: string; value: string }>;

/* Keeps only the name=value pair: one client talks to one server, so path, domain and expiry are not needed. */
export function parseSetCookie(setCookie: string): Maybe<Cookie> {
    const [pair = ""] = setCookie.split(";");
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex <= 0) return undefined;

    const name = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    return name ? { name, value } : undefined;
}

export function mergeSetCookies(cookies: Cookies, setCookies: ReadonlyArray<string>): Cookies {
    const parsed = setCookies
        .map(parseSetCookie)
        .filter(isDefined)
        .map(({ name, value }): [string, string] => [name, value]);

    return parsed.length > 0 ? new Map([...cookies, ...parsed]) : cookies;
}

export function toCookieHeader(cookies: Cookies): Maybe<string> {
    const header = [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
    return header || undefined;
}
