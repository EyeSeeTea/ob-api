import { Codec, string } from "purify-ts";
import { CancelableResponse } from "../repositories/CancelableResponse";
import { Maybe } from "../utils/ts-utils";
import type { EndpointApi } from "./endpoints";
import { nullish } from "./responseCheck";

/* The version fields of the OpenBoxes application context; the other fields are not typed. */
export type OBAppContext = Readonly<{
    appVersion: Maybe<string>;
    buildNumber: Maybe<string>;
    buildDate: Maybe<string>;
}>;

export type AppContext = Readonly<{
    /* OpenBoxes answers 500 when the session has no location. */
    get(): CancelableResponse<OBAppContext>;
}>;

export const appContextResponseCodec = Codec.interface({
    data: Codec.interface({
        appVersion: nullish(string),
        buildNumber: nullish(string),
        buildDate: nullish(string),
    }),
});

export function createAppContext(api: EndpointApi): AppContext {
    function get(): CancelableResponse<OBAppContext> {
        return api.request({ method: "get", path: "/getAppContext" }).map(({ data: { data } }) => ({
            appVersion: data.appVersion ?? undefined,
            buildNumber: data.buildNumber ?? undefined,
            buildDate: data.buildDate ?? undefined,
        }));
    }

    return { get };
}
