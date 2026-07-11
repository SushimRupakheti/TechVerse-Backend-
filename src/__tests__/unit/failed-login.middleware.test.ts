import {
  clearFailedLogins,
  failedLoginBlocker,
  recordFailedLogin,
  resetFailedLoginTracker,
} from "../../middlewares/failed-login.middleware";

describe("failed login IP blocking", () => {
  const request = { ip: "127.0.0.55", socket: {} } as any;

  beforeEach(resetFailedLoginTracker);

  function response() {
    const res: any = {};
    res.setHeader = jest.fn();
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
  }

  test("allows the first five failed attempts and blocks the next request", () => {
    for (let attempt = 0; attempt < 5; attempt += 1) recordFailedLogin(request);

    const res = response();
    const next = jest.fn();
    failedLoginBlocker(request, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
  });

  test("a successful login clears failures for that IP", () => {
    for (let attempt = 0; attempt < 5; attempt += 1) recordFailedLogin(request);
    clearFailedLogins(request);

    const res = response();
    const next = jest.fn();
    failedLoginBlocker(request, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
