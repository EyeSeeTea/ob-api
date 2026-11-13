# api-session Specification

## Purpose

Manages the OpenBoxes login session for the client, so callers give credentials once and do not handle the session cookie, the first login or an expired session.

## Requirements

### Requirement: Client creation does not send requests

Creating a client SHALL be synchronous and SHALL NOT send a request. The client options SHALL include `baseUrl` and `auth` (`username`, `password`), and optionally `locationId`, `timeout` and `apiPath`.

#### Scenario: Create a client

- **WHEN** the caller creates a client with `baseUrl` and `auth`
- **THEN** the client is ready to use and no request goes to the server

### Requirement: Lazy login before the first request

Before it sends the first request, the client SHALL log in with a `POST` to `<apiPath>/login` and the JSON body `{ username, password }`. When a location is set, the body SHALL also contain `location`.

#### Scenario: First request

- **WHEN** the caller runs the first `get("/products")` on a new client
- **THEN** the client sends the login request first, then the products request

#### Scenario: Login with a location

- **WHEN** the client has `locationId` `"L1"` and sends its first request
- **THEN** the login body is `{ "username": ..., "password": ..., "location": "L1" }`

#### Scenario: Later requests

- **WHEN** the client is logged in and the caller sends another request
- **THEN** the client does not log in again

### Requirement: One login for concurrent requests

When several requests need a login at the same time, the client SHALL send one login request and SHALL send each waiting request after that login completes.

#### Scenario: Parallel first requests

- **WHEN** the caller starts three requests at the same time on a new client
- **THEN** the client sends one login request, then the three requests

### Requirement: Explicit login

The client SHALL supply `login(locationId?)`. It SHALL log in again even when a session exists. When `locationId` is given, the client SHALL use it for this login. When that login succeeds, the client SHALL use the location for all later logins. When it fails, later logins SHALL keep the location of the last successful login.

#### Scenario: Change location

- **WHEN** the caller runs `login("L2")`
- **THEN** the client sends a login request with `location` `"L2"`, and later automatic logins also use `"L2"`

#### Scenario: Refresh the session

- **WHEN** the caller runs `login()` on a logged-in client
- **THEN** the client sends a new login request with the current location

#### Scenario: Failed location change

- **WHEN** the client logged in with `"L1"`, and `login("L2")` fails
- **THEN** `login("L2")` rejects, and the next automatic login uses `"L1"`

### Requirement: Login failure

When the login request fails, the client SHALL reject the login and every request that waits for it with an HTTP error. The client SHALL try to log in again on the next request.

#### Scenario: Wrong credentials

- **WHEN** the server rejects the login request with status `401`
- **THEN** the waiting request rejects with an HTTP error that contains the login response, and the client does not retry

### Requirement: Retry once after an expired session

When a request gets status `401`, the client SHALL log in again and send the same request one more time. When the second attempt also gets `401`, the client SHALL reject with an HTTP error. This rule SHALL apply to every method.

#### Scenario: Expired session

- **WHEN** a request gets status `401` and the new login succeeds
- **THEN** the client sends the same request again and returns its response

#### Scenario: Second 401

- **WHEN** a request gets status `401`, the new login succeeds, and the second attempt also gets `401`
- **THEN** the request rejects with an HTTP error and the client does not try again

#### Scenario: Several requests expire together

- **WHEN** three requests get status `401` at the same time
- **THEN** the client sends one login request, then sends the three requests again

### Requirement: Session cookie in Node

In Node, the client SHALL keep the session cookie from the login response and SHALL send it with each later request.

#### Scenario: Cookie is sent

- **WHEN** the login response sets `JSESSIONID=abc` and the caller then sends a request in Node
- **THEN** the request contains the header `Cookie: JSESSIONID=abc`

### Requirement: Session cookie in the browser

In the browser, the client SHALL send requests with browser credentials included, so the browser stores and sends the session cookie. It SHALL also work in browsers whose response headers have no `getSetCookie`.

#### Scenario: Browser request

- **WHEN** the client sends a request in the browser
- **THEN** the request includes browser credentials

#### Scenario: Browser without getSetCookie

- **WHEN** the response headers have no `getSetCookie` method
- **THEN** the request succeeds and later requests send no `Cookie` header
