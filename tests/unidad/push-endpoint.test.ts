import { describe, expect, it, vi } from "vitest";

vi.mock("web-push", () => ({ sendNotification: vi.fn(), setVapidDetails: vi.fn() }));
vi.mock("@/lib/data/sql");

import { endpointPermitido } from "@/lib/data/push";

describe("endpointPermitido", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/abc",
    "https://wns2-par02p.notify.windows.com/w/?token=x",
  ])("acepta %s", (u) => expect(endpointPermitido(u)).toBe(true));

  it.each([
    "http://fcm.googleapis.com/x",
    "https://169.254.169.254/latest",
    "https://localhost/x",
    "https://10.0.0.5/x",
    "https://fcm.googleapis.com.evil.com/x",
    "https://evilfcm.googleapis.com.attacker.io/x",
    "https://user:pw@fcm.googleapis.com/x",
    "https://fcm.googleapis.com:8443/x",
    "no es url",
  ])("rechaza %s", (u) => expect(endpointPermitido(u)).toBe(false));
});
