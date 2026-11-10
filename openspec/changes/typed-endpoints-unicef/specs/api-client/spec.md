## ADDED Requirements

### Requirement: Typed endpoints check the response

A typed endpoint (for example `api.products.list()`) SHALL check the response body against the fields it returns. A field that it returns and that is missing or has a wrong type SHALL reject the request with an HTTP error that keeps the response and names the endpoint and the problem. Fields that the endpoint does not return SHALL be ignored, so fields that a newer OpenBoxes adds do not cause an error.

#### Scenario: Missing field

- **WHEN** a product in the response of `api.products.list()` has no `productCode`
- **THEN** the request rejects with an HTTP error that keeps the response, and its message names `GET …/products` and `productCode`

#### Scenario: Extra field

- **WHEN** a product in the response has a field that the endpoint does not return, for example `color`
- **THEN** the request succeeds and the result does not contain that field
