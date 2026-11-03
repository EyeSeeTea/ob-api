import { describe, expect, it } from "vitest";
import { mergeSetCookies, parseSetCookie, toCookieHeader } from "../cookies";

const SESSION_SET_COOKIE = "JSESSIONID=abc; Path=/openboxes; HttpOnly";

describe("parseSetCookie", () => {
    it("keeps the name and value and drops the attributes", () => {
        expect(parseSetCookie(SESSION_SET_COOKIE)).toEqual({ name: "JSESSIONID", value: "abc" });
    });

    it("keeps an equals sign inside the value", () => {
        expect(parseSetCookie("token=a=b; Path=/")).toEqual({ name: "token", value: "a=b" });
    });

    it("rejects a header without a name", () => {
        expect(parseSetCookie("=abc")).toBeUndefined();
        expect(parseSetCookie("garbage")).toBeUndefined();
    });
});

describe("mergeSetCookies", () => {
    it("adds several cookies", () => {
        const cookies = mergeSetCookies(new Map(), [SESSION_SET_COOKIE, "lang=en; Path=/"]);

        expect(toCookieHeader(cookies)).toEqual("JSESSIONID=abc; lang=en");
    });

    it("replaces a cookie with the same name", () => {
        const cookies = mergeSetCookies(new Map([["JSESSIONID", "old"]]), [SESSION_SET_COOKIE]);

        expect(toCookieHeader(cookies)).toEqual("JSESSIONID=abc");
    });

    it("returns the same cookies when nothing is set", () => {
        const cookies = new Map([["JSESSIONID", "abc"]]);

        expect(mergeSetCookies(cookies, [])).toBe(cookies);
    });
});

describe("toCookieHeader", () => {
    it("returns undefined without cookies", () => {
        expect(toCookieHeader(new Map())).toBeUndefined();
    });
});
